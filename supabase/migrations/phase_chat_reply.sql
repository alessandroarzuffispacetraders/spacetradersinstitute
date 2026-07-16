-- Rispondi a un messaggio (quote) nelle chat.
-- Oltre all'id del messaggio citato (`reply_to`, per lo scroll-to e l'integrità),
-- salviamo uno SNAPSHOT denormalizzato di autore e anteprima: così la citazione
-- resta leggibile anche se il messaggio originale non è caricato in pagina
-- (paginazione) o viene poi cancellato.
--
-- RLS: le policy INSERT/SELECT su `messages` filtrano per user_id/channel, NON per
-- colonna → aggiungere queste colonne non richiede modifiche alle policy.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_author text;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_preview text;
