-- Design Ref: §3.1 ② — PDF 쪽수 한도를 100쪽에서 300쪽으로 늘리면서, 글자 저장 표의 쪽수 규칙도 같은 숫자로 맞춘다.
-- (코드만 300쪽으로 바꾸고 이 규칙을 두면 100쪽을 넘는 PDF의 글자 저장이 거부된다)
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.

alter table public.institution_texts drop constraint if exists institution_texts_page_count_check;
alter table public.institution_texts add constraint institution_texts_page_count_check check (page_count between 1 and 300);
