// Pure validation helpers; no database writes or payment requests.
export function validatePayment(payment: any, pedido: any): boolean {
 const amount=Number(payment?.transaction_amount),expected=Number(pedido?.valor_total);
 const reference=payment?.external_reference ?? payment?.metadata?.pedido_id;
 return !!pedido?.id && String(reference)===String(pedido.id)
  && payment?.currency_id==='BRL' && Number.isFinite(amount)
  && Number.isFinite(expected) && amount>0 && expected>0
  && Math.abs(amount*100-Math.round(amount*100))<0.000001
  && Math.round(amount*100)===Math.round(expected*100);
}
export async function verifySignature(req: Request,secret: string): Promise<boolean> {
 if(!secret)return false;
 const id=new URL(req.url).searchParams.get('data.id');
 const requestId=req.headers.get('x-request-id');
 const parts=(req.headers.get('x-signature')||'').split(',').map(p=>p.trim().split('='));
 const ts=parts.find(p=>p[0]==='ts')?.[1],signature=parts.find(p=>p[0]==='v1')?.[1];
 if(!id||!requestId||!ts||!/^\d+$/.test(ts)||!signature||!/^[a-f0-9]{64}$/i.test(signature))return false;
 const manifest=`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`;
 const encoder=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const bytes=Uint8Array.from(signature.match(/../g)!,hex=>parseInt(hex,16));
 return crypto.subtle.verify('HMAC',key,bytes,encoder.encode(manifest));
}
