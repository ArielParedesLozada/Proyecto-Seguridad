using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddColumnEncryption : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Name",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "Content",
                table: "project_files");

            migrationBuilder.AddColumn<byte[]>(
                name: "name_cipher",
                table: "projects",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "content_cipher",
                table: "project_files",
                type: "bytea",
                nullable: true);

            migrationBuilder.Sql(@"
                CREATE SCHEMA IF NOT EXISTS app_crypto;

                CREATE OR REPLACE FUNCTION app_crypto.encrypt_text(plaintext text, key text)
                RETURNS bytea LANGUAGE sql SECURITY DEFINER AS $$
                  SELECT '\x01'::bytea || pgp_sym_encrypt(plaintext, key, 'cipher-algo=aes256');
                $$;

                CREATE OR REPLACE FUNCTION app_crypto.decrypt_text(payload bytea, key text)
                RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
                BEGIN
                  CASE get_byte(payload, 0)
                    WHEN 1 THEN RETURN pgp_sym_decrypt(substring(payload from 2), key);
                    ELSE RAISE EXCEPTION 'Algoritmo de cifrado desconocido: %', get_byte(payload, 0);
                  END CASE;
                END;
                $$;

                REVOKE ALL ON FUNCTION app_crypto.encrypt_text(text, text) FROM PUBLIC;
                REVOKE ALL ON FUNCTION app_crypto.decrypt_text(bytea, text) FROM PUBLIC;
                GRANT EXECUTE ON FUNCTION app_crypto.encrypt_text(text, text) TO overleaf_app;
                GRANT EXECUTE ON FUNCTION app_crypto.decrypt_text(bytea, text) TO overleaf_app;

                GRANT SELECT (""Id"", ""ProjectId"", ""ParentId"", ""Name"", ""Type"", ""CreatedAt"", ""UpdatedAt"")
                  ON project_files TO overleaf_app;
                GRANT INSERT, UPDATE, DELETE ON project_files TO overleaf_app;

                GRANT SELECT (""Id"", ""OwnerId"", ""CreatedAt"", ""UpdatedAt"", ""IsArchived"")
                  ON projects TO overleaf_app;
                GRANT INSERT, UPDATE, DELETE ON projects TO overleaf_app;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                REVOKE ALL ON FUNCTION app_crypto.encrypt_text(text, text) FROM overleaf_app;
                REVOKE ALL ON FUNCTION app_crypto.decrypt_text(bytea, text) FROM overleaf_app;
                DROP FUNCTION IF EXISTS app_crypto.encrypt_text(text, text);
                DROP FUNCTION IF EXISTS app_crypto.decrypt_text(bytea, text);
                DROP SCHEMA IF EXISTS app_crypto;
            ");

            migrationBuilder.DropColumn(
                name: "name_cipher",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "content_cipher",
                table: "project_files");

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "projects",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Content",
                table: "project_files",
                type: "text",
                nullable: true);
        }
    }
}
