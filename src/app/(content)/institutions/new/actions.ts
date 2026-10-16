"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  DAILY_REGISTRATION_LIMIT,
  MAX_FILE_NAME_LENGTH,
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
  MAX_PDF_TEXT_CHARS,
  MAX_URL_LENGTH,
  PDF_TEXT_TIMEOUT_MS,
} from "@/lib/registration-limits";
import { AiError, describeAiError, extractWithAi } from "@/lib/ai-extract";
import { verifyExtraction, type ItemSpec } from "@/lib/extraction-verify";
import { listItems } from "@/lib/items";
import { readWithFollowedLinks } from "@/lib/link-reader";
import { decodeHtml, extractVisibleText, findClientRedirect, WebTextError } from "@/lib/html-text";
import { extractPdfText, PdfTextError, type PdfText } from "@/lib/pdf-text";
import { describeSafeFetchError, safeFetchPage, SafeFetchError } from "@/lib/safe-fetch";
import { getTodayRegistrationCount } from "@/lib/registration";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Design Ref: §3.1 ① — 기관 등록 검사: 로그인 확인, 하루 20곳 한도, PDF 20MB·300쪽, URL은 http·https만.
// PDF는 20MB가 서버 요청 한도(4.5MB)를 넘으므로 서버가 "사용자별 업로드 주소"만 만들어 주고 브라우저가 거기로 직접 올린다.
// Plan SC: 작업 10 — 기관 등록 화면. (자료 읽기·AI 정리는 작업 11~13에서 이어 붙인다)

export type RegistrationResult =
  | { status: "error"; message?: string; fieldErrors?: Partial<Record<"name" | "url" | "file", string>> }
  | { status: "pdf-ready"; institutionId: string; uploadUrl: string }
  | { status: "url-ready"; institutionId: string }
  | {
      status: "accepted";
      institutionId: string;
      name: string;
      kind: "url" | "pdf";
      // 글자를 읽은 결과. (미리보기는 읽은 글자의 앞부분) kind: 웹페이지 본문인지 PDF인지
      reading?: { kind: "web" | "pdf"; pageCount: number; charCount: number; preview: string; followedPages?: string[] };
    };

// 3단계(AI 정리) 결과: 결과는 DB에 저장되어 있으므로 화면은 결과 확인 화면(/institutions/[id])으로 이동해 읽는다.
export type AnalyzeResult = { status: "error"; message: string } | { status: "organized"; institutionId: string };

const NameSchema = z
  .string()
  .trim()
  .min(1, { error: "기관 이름을 입력해 주세요." })
  .max(100, { error: "기관 이름은 100자 이하여야 합니다." });

const UrlSchema = z
  .string()
  .trim()
  .min(1, { error: "홈페이지 주소를 입력해 주세요." })
  .max(MAX_URL_LENGTH, { error: "주소가 너무 깁니다." })
  .transform((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "주소 형식이 올바르지 않습니다. https://로 시작하는 전체 주소를 입력해 주세요." });
      return z.NEVER;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({ code: "custom", message: "http:// 또는 https://로 시작하는 주소만 사용할 수 있습니다." });
      return z.NEVER;
    }
    if (parsed.username || parsed.password) {
      ctx.addIssue({ code: "custom", message: "주소에 아이디나 비밀번호를 넣을 수 없습니다." });
      return z.NEVER;
    }
    return parsed.href;
  });

const FileInfoSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, { error: "PDF 파일을 선택해 주세요." })
    .max(MAX_FILE_NAME_LENGTH, { error: "파일 이름이 너무 깁니다." })
    .refine((value) => value.toLowerCase().endsWith(".pdf"), { error: "PDF 파일(.pdf)만 올릴 수 있습니다." }),
  fileSize: z
    .number()
    .int()
    .min(1, { error: "빈 파일은 올릴 수 없습니다." })
    .max(MAX_PDF_BYTES, { error: "PDF는 20MB 이하만 올릴 수 있습니다." }),
});

export type RegistrationInput = {
  name: string;
  sourceType: "url" | "pdf";
  url?: string;
  fileName?: string;
  fileSize?: number;
};

// 같은 요청이 동시에 여러 번 들어와도 일(자료 읽기·AI 정리)이 한 번만 실행되게 한다. (CHECK P1-1)
// 일을 시작하기 직전에 DB에서 "조건부 갱신"으로 진행 단계를 `busy_…`로 바꿔 둔다. DB는 같은 줄의 갱신을 한 번에 하나씩만 처리하므로,
// 동시에 여러 요청이 와도 갱신이 성공하는 것은 하나뿐이다. 성공하지 못한 요청은 아무 일도 하지 않고 돌아간다.
async function claimStep(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  institutionId: string,
  from: "reading" | "organizing",
): Promise<boolean> {
  const { data } = await supabase
    .from("institutions")
    .update({ step: from === "reading" ? "busy_reading" : "busy_organizing" })
    .eq("id", institutionId)
    .eq("status", "processing")
    .eq("step", from)
    .select("id");
  return data?.length === 1;
}

const ALREADY_RUNNING = "이미 처리 중인 기관입니다. 잠시 뒤 결과 화면에서 확인해 주세요.";

const LIMIT_MESSAGE = `오늘 등록 한도(${DAILY_REGISTRATION_LIMIT}곳)를 모두 사용했습니다. 내일 0시(한국시간) 이후에 다시 등록할 수 있습니다.`;

// 서비스 전체 하루 등록 한도(DB 규칙 SERVICE_LIMIT, 200곳)에 도달했을 때. 계정별 한도 문구(DAILY_LIMIT)와 구분해서 안내한다.
const SERVICE_LIMIT_MESSAGE = "오늘은 서비스 전체 등록 한도에 도달했습니다. 내일 0시(한국시간) 이후에 다시 등록해 주세요.";

// 1단계: 검사 → 기관 접수 → (PDF면) 업로드 주소 발급
export async function prepareRegistration(input: RegistrationInput): Promise<RegistrationResult> {
  const user = await requireUser();

  const name = NameSchema.safeParse(input.name);
  const fieldErrors: NonNullable<Extract<RegistrationResult, { status: "error" }>["fieldErrors"]> = {};
  if (!name.success) fieldErrors.name = name.error.issues[0]?.message;

  let sourceRef = "";
  if (input.sourceType === "url") {
    const url = UrlSchema.safeParse(input.url ?? "");
    if (url.success) sourceRef = url.data;
    else fieldErrors.url = url.error.issues[0]?.message;
  } else if (input.sourceType === "pdf") {
    const file = FileInfoSchema.safeParse({ fileName: input.fileName ?? "", fileSize: input.fileSize ?? 0 });
    if (file.success) sourceRef = file.data.fileName;
    else fieldErrors.file = file.error.issues[0]?.message;
  } else {
    return { status: "error", message: "등록 방법을 골라 주세요." };
  }

  if (Object.keys(fieldErrors).length > 0 || !name.success) return { status: "error", fieldErrors };

  // 친절한 안내를 위한 미리 확인. (실제 한도는 DB 규칙이 한 번 더 지킨다)
  if ((await getTodayRegistrationCount()) >= DAILY_REGISTRATION_LIMIT) {
    return { status: "error", message: LIMIT_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();

  const { data: institution, error: insertError } = await supabase
    .from("institutions")
    .insert({ name: name.data, source_type: input.sourceType, source_ref: sourceRef, status: "processing", step: "reading" })
    .select("id")
    .single();
  if (insertError || !institution) {
    return { status: "error", message: "등록 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." };
  }

  // 검사를 통과한 시점에 1회로 센다. 한도를 넘었으면 방금 만든 기관을 되돌린다.
  const { error: usageError } = await supabase.from("usage_log").insert({});
  if (usageError) {
    await supabase.from("institutions").delete().eq("id", institution.id);
    if (usageError.message?.includes("SERVICE_LIMIT")) return { status: "error", message: SERVICE_LIMIT_MESSAGE };
    if (usageError.message?.includes("DAILY_LIMIT")) return { status: "error", message: LIMIT_MESSAGE };
    return { status: "error", message: "등록 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." };
  }

  revalidatePath("/institutions/new");

  // 홈페이지 주소: 접수만 하고, 페이지를 읽는 것은 다음 단계(finalizeUrlRegistration)에서 한다.
  if (input.sourceType === "url") {
    return { status: "url-ready", institutionId: institution.id };
  }

  // 업로드 경로는 브라우저가 정하지 않고 서버가 "내 번호/기관 번호"로 계산한다. (남의 폴더에 올릴 수 없다)
  const path = `${user.id}/${institution.id}.pdf`;
  const { data: signed, error: signError } = await supabase.storage.from("uploads").createSignedUploadUrl(path);
  if (signError || !signed) {
    await markFailed(institution.id, "업로드 주소를 만들지 못했습니다.");
    return { status: "error", message: "업로드를 준비하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }

  return { status: "pdf-ready", institutionId: institution.id, uploadUrl: signed.signedUrl };
}

// 2단계(홈페이지 주소만): 서버가 페이지를 안전하게 가져와 본문 글자를 꺼낸다.
// 접속할 주소는 브라우저가 아니라 접수할 때 DB에 저장한 값을 쓴다. (중간에 바꿔치기할 수 없다)
export async function finalizeUrlRegistration(institutionId: string): Promise<RegistrationResult> {
  await requireUser();
  const id = z.uuid().safeParse(institutionId);
  if (!id.success) return { status: "error", message: "등록 정보를 찾을 수 없습니다." };

  const supabase = await createSupabaseServerClient();
  const { data: institution } = await supabase
    .from("institutions")
    .select("id, name, source_type, source_ref, status, step")
    .eq("id", id.data)
    .maybeSingle();
  if (!institution || institution.source_type !== "url" || institution.status !== "processing" || institution.step !== "reading") {
    return { status: "error", message: "등록 정보를 찾을 수 없습니다." };
  }
  if (!(await claimStep(supabase, institution.id, "reading"))) return { status: "error", message: ALREADY_RUNNING };

  const fail = async (reason: string): Promise<RegistrationResult> => {
    await markFailed(institution.id, reason);
    return { status: "error", message: reason };
  };

  let reading: ReadingResult;
  try {
    reading = await readUrlSource(institution.source_ref);
  } catch (error) {
    if (error instanceof SafeFetchError) return fail(describeSafeFetchError(error));
    if (error instanceof PdfTextError) return fail(describePdfError(error));
    if (error instanceof WebTextError) return fail(describeWebError(error));
    return fail("페이지를 읽을 수 없습니다. 파일이 너무 복잡하거나 손상되었을 수 있습니다.");
  }

  // 웹페이지면 AI가 같은 사이트의 관련 링크(최대 5개, 1단계)를 골라 글자를 더 가져온다. 하나도 못 가져오면 입력한 페이지만으로 계속한다.
  if (reading.kind === "web" && reading.web) {
    const items = await listItems();
    const more = await readWithFollowedLinks({
      institutionName: institution.name,
      items: items.map((item) => ({ name: item.name, description: item.description })),
      startUrl: institution.source_ref,
      pageUrl: reading.web.pageUrl,
      html: reading.web.html,
      title: reading.web.title,
      startText: reading.web.startText,
    });
    if (more) {
      reading = {
        kind: "web",
        pageCount: more.pageCount,
        charCount: more.charCount,
        content: more.content,
        followedPages: more.followed.map((page) => page.url),
      };
    }
  }

  const { error: saveError } = await supabase.from("institution_texts").upsert({
    institution_id: institution.id,
    content: reading.content,
    page_count: reading.pageCount,
    char_count: reading.charCount,
  });
  if (saveError) return fail("읽은 글자를 저장하지 못했습니다. 다시 시도해 주세요.");

  await supabase.from("institutions").update({ step: "organizing" }).eq("id", institution.id);

  revalidatePath("/institutions/new");
  return {
    status: "accepted",
    institutionId: institution.id,
    name: institution.name,
    kind: "url",
    reading: {
      kind: reading.kind,
      pageCount: reading.pageCount,
      charCount: reading.charCount,
      preview: reading.content.slice(0, 600),
      followedPages: reading.followedPages,
    },
  };
}

// 2단계(PDF만): 올라온 파일을 서버가 다시 확인한다. 신고한 값이 아니라 실제 크기·PDF 여부·쪽수를 본다.
export async function finalizePdfRegistration(institutionId: string): Promise<RegistrationResult> {
  const user = await requireUser();
  const id = z.uuid().safeParse(institutionId);
  if (!id.success) return { status: "error", message: "등록 정보를 찾을 수 없습니다." };

  const supabase = await createSupabaseServerClient();
  const { data: institution } = await supabase
    .from("institutions")
    .select("id, name, source_type, status, step")
    .eq("id", id.data)
    .maybeSingle();
  if (!institution || institution.source_type !== "pdf" || institution.status !== "processing" || institution.step !== "reading") {
    return { status: "error", message: "등록 정보를 찾을 수 없습니다." };
  }
  if (!(await claimStep(supabase, institution.id, "reading"))) return { status: "error", message: ALREADY_RUNNING };

  const path = `${user.id}/${institution.id}.pdf`;
  const fail = async (reason: string): Promise<RegistrationResult> => {
    await supabase.storage.from("uploads").remove([path]); // 남은 파일은 바로 지운다.
    await markFailed(institution.id, reason);
    return { status: "error", message: reason };
  };

  const { data: blob, error: downloadError } = await supabase.storage.from("uploads").download(path);
  if (downloadError || !blob) return fail("파일을 올리지 못했습니다. 다시 시도해 주세요.");
  if (blob.size > MAX_PDF_BYTES) return fail("PDF는 20MB 이하만 올릴 수 있습니다.");

  const bytes = new Uint8Array(await blob.arrayBuffer());
  // PDF 파일은 `%PDF-`로 시작한다. 이름만 .pdf인 다른 파일을 걸러 낸다.
  const header = new TextDecoder("latin1").decode(bytes.slice(0, 1024));
  if (!header.includes("%PDF-")) return fail("PDF 파일이 아닙니다.");

  // 쪽수 확인 → 쪽마다 `[p.N]` 표시를 붙여 글자 꺼내기. 시간이 너무 오래 걸리면 포기한다.
  let extracted: PdfText;
  try {
    extracted = await withTimeout(extractPdfText(bytes), PDF_TEXT_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof PdfTextError) return fail(describePdfError(error));
    return fail("PDF를 읽을 수 없습니다. 파일이 너무 복잡하거나 손상되었을 수 있습니다.");
  }

  // 글자를 임시로 저장한다. (다시 시도할 때 파일을 다시 올리지 않도록. AI 정리 단계가 이 글자를 읽는다)
  const { error: saveError } = await supabase.from("institution_texts").upsert({
    institution_id: institution.id,
    content: extracted.content,
    page_count: extracted.pageCount,
    char_count: extracted.charCount,
  });
  if (saveError) return fail("읽은 글자를 저장하지 못했습니다. 다시 시도해 주세요.");

  // 글자를 꺼냈으니 PDF 원본은 바로 지운다. 이제 "자료 읽는 중"이 끝나고 "항목 정리 중" 차례가 된다.
  await supabase.storage.from("uploads").remove([path]);
  await supabase.from("institutions").update({ step: "organizing" }).eq("id", institution.id);

  revalidatePath("/institutions/new");
  return {
    status: "accepted",
    institutionId: institution.id,
    name: institution.name,
    kind: "pdf",
    reading: {
      kind: "pdf",
      pageCount: extracted.pageCount,
      charCount: extracted.charCount,
      preview: extracted.content.slice(0, 600),
    },
  };
}

// 3단계: 읽어 둔 글자를 AI가 항목별로 정리하고, 서버가 원문과 대조해 확인된 값만 "확인됨"으로 저장한다. (작업 13)
// 입력은 브라우저가 아니라 DB에 저장된 글자·항목·출처(주소 또는 파일 이름)만 쓴다. 출처는 AI가 아니라 서버가 채운다. (CHECK 2-6)
export async function analyzeInstitution(institutionId: string): Promise<AnalyzeResult> {
  await requireUser();
  const id = z.uuid().safeParse(institutionId);
  if (!id.success) return { status: "error", message: "등록 정보를 찾을 수 없습니다." };

  const supabase = await createSupabaseServerClient();
  const { data: institution } = await supabase
    .from("institutions")
    .select("id, name, source_ref, status, step")
    .eq("id", id.data)
    .maybeSingle();
  if (!institution || institution.status !== "processing" || institution.step !== "organizing") {
    return { status: "error", message: "등록 정보를 찾을 수 없습니다." };
  }
  // AI를 부르기 전에 작업을 먼저 차지한다. 같은 요청이 동시에 여러 번 와도 AI는 한 번만 실행된다. (비용 보호)
  if (!(await claimStep(supabase, institution.id, "organizing"))) return { status: "error", message: ALREADY_RUNNING };

  const fail = async (reason: string): Promise<AnalyzeResult> => {
    // 읽은 글자는 그대로 둔다. (다시 시도할 때 자료를 다시 읽지 않아도 된다)
    await markFailed(institution.id, reason);
    return { status: "error", message: reason };
  };

  const { data: text } = await supabase.from("institution_texts").select("content").eq("institution_id", institution.id).maybeSingle();
  if (!text?.content) return fail("읽어 둔 글자를 찾지 못했습니다. 처음부터 다시 등록해 주세요.");

  const items = await listItems();
  if (items.length === 0) return fail("정리할 항목이 없습니다. 항목 관리에서 항목을 추가해 주세요.");
  const specs: ItemSpec[] = items.map((item, index) => ({
    id: item.id,
    key: String(index + 1),
    name: item.name,
    valueType: item.value_type === "number" ? "number" : "text",
  }));
  const descriptions = new Map(items.map((item) => [item.id, item.description]));

  let verified;
  try {
    const ai = await extractWithAi({ institutionName: institution.name, items: specs, descriptions, content: text.content });
    verified = verifyExtraction({ raw: ai.raw, items: specs, content: text.content, sourceRef: institution.source_ref });
  } catch (error) {
    if (error instanceof AiError) return fail(describeAiError(error));
    return fail("항목을 정리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }

  // 모든 항목에 대해 한 줄씩 저장한다. (다시 정리할 때는 같은 항목 줄을 덮어쓴다)
  const { error: saveError } = await supabase.from("extracted_values").upsert(
    verified.values.map((value) => ({
      institution_id: institution.id,
      item_id: value.itemId,
      status: value.status,
      value_text: value.valueText,
      value_number: value.valueNumber,
      unit: value.unit,
      value_year: value.valueYear,
      source_ref: value.sourceRef,
      source_quote: value.sourceQuote,
      unverifiable_reason: value.status === "unverifiable" ? (value.reason ?? "").slice(0, 200) || null : null,
    })),
    { onConflict: "institution_id,item_id" },
  );
  if (saveError) return fail("정리한 결과를 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");

  // 사용자가 결과 확인 화면에서 기준연도를 확인하고 저장하기 전까지는 "확인 대기" 상태로 둔다. (목록·비교에 나타나지 않는다)
  const { error: updateError } = await supabase
    .from("institutions")
    .update({ status: "pending_review", step: null, base_year: verified.baseYear })
    .eq("id", institution.id);
  if (updateError) return fail("정리한 결과를 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");

  revalidatePath("/institutions/new");
  return { status: "organized", institutionId: institution.id };
}

// web: 웹페이지를 읽었을 때만 있다. 링크를 따라갈 때 필요한 원본 HTML과 실제로 읽은 주소(메모리에서만 쓰고 저장하지 않는다)
type ReadingResult = {
  kind: "web" | "pdf";
  pageCount: number;
  charCount: number;
  content: string;
  web?: { html: string; pageUrl: string; startText: string; title: string };
  followedPages?: string[];
};

// 최대 2번까지, 본문이 비어 있는 "다른 주소로 넘기는 페이지"의 목적지를 따라간다. 넘어갈 때마다 처음부터 안전 검사를 다시 한다.
const MAX_CLIENT_REDIRECTS = 2;

async function readUrlSource(startUrl: string): Promise<ReadingResult> {
  let url = startUrl;
  for (let hop = 0; ; hop += 1) {
    const page = await safeFetchPage(url);

    if (page.kind === "pdf") {
      // 주소가 PDF 파일을 가리키는 경우: PDF 방식으로 읽는다. (20MB·300쪽·글자 수 한도 동일)
      const header = new TextDecoder("latin1").decode(page.bytes.slice(0, 1024));
      if (!header.includes("%PDF-")) throw new PdfTextError("UNREADABLE");
      const pdf = await withTimeout(extractPdfText(page.bytes), PDF_TEXT_TIMEOUT_MS);
      return { kind: "pdf", pageCount: pdf.pageCount, charCount: pdf.charCount, content: pdf.content };
    }

    const html = decodeHtml(page.bytes, page.charset);
    try {
      const web = extractVisibleText(html);
      const startText = web.content.replace(/^\[web\]\n?/, "");
      const title = /^제목: (.*)$/m.exec(startText)?.[1] ?? "";
      return {
        kind: "web",
        pageCount: 1,
        charCount: web.charCount,
        content: web.content,
        web: { html, pageUrl: page.finalUrl, startText, title },
      };
    } catch (error) {
      if (!(error instanceof WebTextError) || error.code !== "NO_TEXT" || hop >= MAX_CLIENT_REDIRECTS) throw error;
      const target = findClientRedirect(html);
      const next = target ? safeResolveHttpUrl(target, page.finalUrl) : null;
      if (!next) throw error;
      url = next;
    }
  }
}

// 넘겨 줄 주소가 http·https가 아니거나 형식이 이상하면 따라가지 않는다. (실제 접속 전 검사는 safeFetchPage가 다시 한다)
function safeResolveHttpUrl(target: string, base: string): string | null {
  try {
    const resolved = new URL(target, base);
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.href : null;
  } catch {
    return null;
  }
}

function describeWebError(error: WebTextError): string {
  if (error.code === "TOO_LONG") {
    return `글자가 너무 많아 읽을 수 없습니다. (이 페이지는 ${error.detail?.charCount?.toLocaleString("ko-KR")}자, 상한 ${MAX_PDF_TEXT_CHARS.toLocaleString("ko-KR")}자) 필요한 부분만 PDF로 올려 주세요.`;
  }
  return "읽을 수 있는 본문이 거의 없는 페이지입니다. 자바스크립트로 그려지는 페이지이거나 자동 접속을 막은 사이트일 수 있어요. 홈페이지 첫 화면보다 교육계획서가 있는 구체적인 페이지의 주소를 입력하거나, 교육계획서를 PDF로 올려 주세요.";
}

// 글자 읽기에서 생긴 문제를 사용자가 이해할 문장으로 바꾼다.
function describePdfError(error: PdfTextError): string {
  switch (error.code) {
    case "TOO_MANY_PAGES":
      return `PDF는 ${MAX_PDF_PAGES}쪽 이하만 올릴 수 있습니다. (이 파일은 ${error.detail?.pageCount}쪽)`;
    case "NO_TEXT":
      return "글자를 읽을 수 없는 PDF입니다. 스캔한 이미지로 된 PDF는 지원하지 않습니다. 글자를 선택·복사할 수 있는 PDF를 올려 주세요.";
    case "TOO_LONG":
      return `글자가 너무 많아 읽을 수 없습니다. (이 파일은 ${error.detail?.charCount?.toLocaleString("ko-KR")}자, 상한 ${MAX_PDF_TEXT_CHARS.toLocaleString("ko-KR")}자) 필요한 부분만 올려 주세요.`;
    default:
      return "PDF를 읽을 수 없습니다. 암호가 걸렸거나 손상된 파일일 수 있습니다.";
  }
}

// 글자를 꺼내기 전에 시간이 너무 오래 걸리는 PDF(폭탄 PDF 등)는 포기한다.
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function markFailed(institutionId: string, reason: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from("institutions").update({ status: "failed", failure_reason: reason }).eq("id", institutionId);
}
