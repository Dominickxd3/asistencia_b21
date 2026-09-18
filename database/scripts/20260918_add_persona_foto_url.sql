IF COL_LENGTH('personas', 'foto_url') IS NULL
BEGIN
    ALTER TABLE personas
    ADD foto_url NVARCHAR(300) NULL;
END;
