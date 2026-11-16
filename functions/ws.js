/**
 * Cloudflare Pages Function: forwards the game's WebSocket (/ws) to the neon-duel Worker
 * through a service binding named GAME, so the game can also be served from a *.pages.dev address.
 */
export async function onRequest(context) {
  return context.env.GAME.fetch(context.request);
}
