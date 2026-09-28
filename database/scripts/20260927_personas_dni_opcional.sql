/* ============================================================
   Personas: DNI opcional de verdad (OPCIONAL, aplicar manualmente)

   UQ_personas_compania_dni es un UNIQUE sobre (compania_id, dni). En SQL Server
   un UNIQUE trata NULL como un valor más: solo puede existir UNA persona sin DNI.
   Este script lo reemplaza por un índice único filtrado (dni IS NOT NULL), que
   mantiene el DNI único cuando existe y permite varias personas sin DNI.

   Idempotente. Mientras no se aplique, la API responde con un mensaje claro
   («Ya existe otra persona sin DNI registrado…»).
   ============================================================ */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM sys.key_constraints
           WHERE name = 'UQ_personas_compania_dni' AND parent_object_id = OBJECT_ID('dbo.personas'))
    ALTER TABLE dbo.personas DROP CONSTRAINT UQ_personas_compania_dni;

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'UX_personas_compania_dni' AND object_id = OBJECT_ID('dbo.personas'))
    CREATE UNIQUE INDEX UX_personas_compania_dni
        ON dbo.personas (compania_id, dni)
        WHERE dni IS NOT NULL;

COMMIT TRANSACTION;

SELECT name, is_unique, filter_definition
FROM sys.indexes
WHERE object_id = OBJECT_ID('dbo.personas') AND name = 'UX_personas_compania_dni';
