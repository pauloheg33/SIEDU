# Fotos e vídeos de eventos

A galeria mantém a categoria `PHOTO` e o bucket privado `photos` existentes;
o campo `mime` diferencia imagens de vídeos, inclusive na página pública.
O limite por arquivo é 500 MiB (524288000 bytes), exibido como 500 MB na interface.
Arquivos maiores que 6 MiB são enviados em partes via TUS, com novas tentativas
automáticas para interrupções de rede durante o envio.

## Ativação em produção

1. Aplicar `supabase/migrations/20260917000000_event_videos.sql`.
2. Em Supabase → Storage → Settings, configurar o limite global de arquivos
   para pelo menos 500 MB. A migração altera o bucket, não o limite global.
   O plano contratado precisa permitir esse tamanho.
3. Publicar o frontend atualizado.
4. Conferir com uma conta autorizada o envio de uma foto e de um vídeo,
   a reprodução nas galerias interna e pública, e a exclusão.
   Verificar também um vídeo próximo de 500 MB e a rejeição acima do limite.

A reprodução depende dos codecs suportados pelo navegador; MP4 com H.264/AAC
é uma opção de ampla compatibilidade.

Referências:
- https://supabase.com/docs/guides/storage/uploads/resumable-uploads
- https://supabase.com/docs/guides/storage/uploads/file-limits
