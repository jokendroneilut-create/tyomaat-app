-- Estaa rivien poiston account_lifecycle-taulusta.
--
-- MIKSI. Taulun koko idea on etta merkinta sailyy vaikka tunnus
-- poistetaan. Ilman tata mikaan ei estaisi poistamasta rivia
-- vahingossa - service role ohittaa RLS:n, joten pelkka RLS ei riita.
--
-- POISTO ESTETAAN, MUOKKAUS EI. Sahkopostin ja nimen on voitava
-- nollata GDPR:n poistopyynnon yhteydessa. Silloin rivi ja aikaleimat
-- jaavat, eli kohortti- ja hankintaluvut sailyvat ilman henkilotietoa.
-- Merkinta ei siis katoa, mutta siita voi pyyhkia nimen.

create or replace function public.account_lifecycle_no_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'account_lifecycle on pysyva loki: rivia ei saa poistaa. Nollaa email/full_name jos kyse on poistopyynnosta.';
end;
$$;

drop trigger if exists account_lifecycle_block_delete on public.account_lifecycle;

create trigger account_lifecycle_block_delete
  before delete on public.account_lifecycle
  for each row
  execute function public.account_lifecycle_no_delete();
