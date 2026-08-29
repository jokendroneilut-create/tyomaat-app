-- Milloin dokumentti nahtiin viimeksi lahteen sivulla.
--
-- TAUSTA. Meilla ei ole ollut mitaan tapaa tietaa etta kaava on poistunut
-- kaupungin sivulta. updated_at ei kelpaa mittariksi kahdesta syysta:
-- faktojen ja identiteetin poimijat paivittavat samaa rivia ilman etta
-- dokumenttia on nahty sivulla, ja osa keraajista lukee listasta vain
-- muutaman sivun kerrallaan (Oulu 2 sivua/vrk). Kun mittasin katoamisia
-- updated_at:lla, Oulusta nayttti kadonneen 39 kaavaa - elava vertailu
-- naytti yhden.
--
-- last_seen_at kirjoitetaan VAIN keraajasta, eli silloin kun dokumentti
-- oikeasti nakyi lahteessa.
--
-- Sarake jatetaan tyhjaksi vanhoille riveille: takautuva arvaus olisi
-- juuri se saastunut updated_at. Kentta tayttyy ensimmaisilla ajoilla.

alter table public.source_documents
  add column if not exists last_seen_at timestamptz;

comment on column public.source_documents.last_seen_at is
  'Milloin kerääjä viimeksi näki dokumentin lähteen listalla. Vain kerääjä kirjoittaa tämän.';

-- Vanhenemiscron hakee riveja jarjestyksessa (source_id, last_seen_at).
create index if not exists source_documents_last_seen_idx
  on public.source_documents (source_id, last_seen_at);

-- Tarkistus:
--   select count(*) as yhteensa,
--          count(last_seen_at) as nahty
--   from public.source_documents;
