-- Fazlı işler: bir işin devam fazları AYRI brief olarak açılır (kendi thread/termin/statüsü),
-- kök işe parent_id ile bağlanır. Raporlar zincir üzerinden ilişki kurar.
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS parent_id integer REFERENCES briefs(id);
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS faz_no integer NOT NULL DEFAULT 1;
