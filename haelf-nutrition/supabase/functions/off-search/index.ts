import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const OFF_SEARCH = 'https://search.openfoodfacts.org/search';
const UA = 'HaelfNutrition/1.0 (supabase-proxy)';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) {
      return new Response(JSON.stringify({ hits: [], count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const params = new URLSearchParams({
      q,
      page_size: '48',
      page: '1',
      langs: 'zh,en',
      fields: 'code,product_name,product_name_en,nutriments',
    });
    const offRes = await fetch(`${OFF_SEARCH}?${params.toString()}`, {
      headers: { 'User-Agent': UA },
    });
    const body = await offRes.text();
    return new Response(body, {
      status: offRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
