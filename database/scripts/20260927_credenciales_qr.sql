SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.persona_qr', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.persona_qr (
    persona_qr_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    persona_id INT NOT NULL,
    codigo VARCHAR(36) NOT NULL CONSTRAINT DF_persona_qr_codigo DEFAULT CONVERT(varchar(36), NEWID()),
    estado VARCHAR(20) NOT NULL CONSTRAINT DF_persona_qr_estado DEFAULT 'ACTIVO',
    generado_por_usuario_id INT NULL,
    fecha_generacion DATETIME2(0) NOT NULL CONSTRAINT DF_persona_qr_fecha DEFAULT SYSDATETIME(),
    fecha_actualizacion DATETIME2(0) NULL,
    CONSTRAINT FK_persona_qr_persona FOREIGN KEY (persona_id) REFERENCES dbo.personas(persona_id),
    CONSTRAINT FK_persona_qr_usuario FOREIGN KEY (generado_por_usuario_id) REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT UQ_persona_qr_persona UNIQUE (persona_id),
    CONSTRAINT UQ_persona_qr_codigo UNIQUE (codigo),
    CONSTRAINT CK_persona_qr_estado CHECK (estado IN ('ACTIVO','REVOCADO'))
  );
END;

INSERT INTO dbo.persona_qr (persona_id, codigo, estado)
SELECT p.persona_id, CONVERT(varchar(36), NEWID()), 'ACTIVO'
FROM dbo.personas p
WHERE NOT EXISTS (SELECT 1 FROM dbo.persona_qr q WHERE q.persona_id = p.persona_id);

COMMIT TRANSACTION;
GO

CREATE OR ALTER TRIGGER dbo.TR_personas_crear_qr
ON dbo.personas
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.persona_qr (persona_id, codigo, estado)
  SELECT i.persona_id, CONVERT(varchar(36), NEWID()), 'ACTIVO'
  FROM inserted i
  WHERE NOT EXISTS (SELECT 1 FROM dbo.persona_qr q WHERE q.persona_id = i.persona_id);
END;
GO
