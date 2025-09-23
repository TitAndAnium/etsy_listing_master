// Browser-veilige API-wrapper voor httpGenerate (Web Crypto API)
const ENDPOINT =
  'https://us-central1-etsy-ai-hacker.cloudfunctions.net/httpGenerate';
// TODO: inject via env-var for prod; hard-coded hier voor dev
const KEY_HEX = '6d4895a6f3040e234d234e27b615efa3a8695084bb1612b29268cb917b3f00d3';

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr;
}

async function hmacHex(payload: string): Promise<string> {
  const keyBytes = hexToBytes(KEY_HEX);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface GenerateResponse {
  ok: boolean;
  result?: any;
  error?: string;
  creditsRemaining?: number;
}

export async function postGenerate(text: string, uid: string): Promise<GenerateResponse> {
  const bodyStr = JSON.stringify({ text, uid });
  const ts = Math.floor(Date.now() / 1000);
  const sig = await hmacHex(bodyStr);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ts': String(ts),
      'x-signature': sig
    },
    body: bodyStr
  });

  const creditsHeader = res.headers.get('x-credits-remaining');
  const json = await res.json();
  return {
    ...(json || {}),
    creditsRemaining: creditsHeader != null ? Number(creditsHeader) : undefined
  };
}
