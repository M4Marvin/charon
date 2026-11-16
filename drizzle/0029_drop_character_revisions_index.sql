-- Drop the redundant per-character index: the unique (character_id, rev)
-- index serves every query pattern (lookup by character_id, the ORDER BY rev
-- DESC list via its leftmost prefix, and the FK cascade on character
-- delete). The plain index was a pure extra write on every save.
DROP INDEX IF EXISTS `character_revisions_character_idx`;
