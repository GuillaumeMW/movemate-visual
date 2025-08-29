import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClientInfo {
  clientName: string;
  city: string;
  quoteId?: string;
}

interface PdfRequest {
  sessionId: string;
  clientInfo: ClientInfo;
  safetyFactor: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, clientInfo, safetyFactor }: PdfRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Generating PDF for session:', sessionId);

    // Fetch inventory items for the session
    const { data: items, error: itemsError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('room', { ascending: true })
      .order('name', { ascending: true });

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      throw new Error('Failed to fetch inventory items');
    }

    // Fetch uploaded images for the session
    const { data: images, error: imagesError } = await supabase
      .from('uploaded_images')
      .select('*')
      .eq('session_id', sessionId)
      .order('analyzed_at', { ascending: true });

    if (imagesError) {
      console.error('Error fetching images:', imagesError);
      throw new Error('Failed to fetch images');
    }

    // Fetch session info
    const { data: session, error: sessionError } = await supabase
      .from('inventory_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      throw new Error('Failed to fetch session info');
    }

    // Group items by room
    const itemsByRoom = items.reduce((acc, item) => {
      const room = item.room || 'Unspecified Room';
      if (!acc[room]) {
        acc[room] = [];
      }
      acc[room].push(item);
      return acc;
    }, {} as Record<string, typeof items>);

    // Calculate totals with safety factor
    const applyLoadingSafetyFactor = (value: number) => value * (1 + safetyFactor);
    const totalItems = items.length;
    const totalVolume = applyLoadingSafetyFactor(items.reduce((sum, item) => sum + (Number(item.volume) * item.quantity), 0));
    const totalWeight = applyLoadingSafetyFactor(items.reduce((sum, item) => sum + (Number(item.weight) * item.quantity), 0));

    // Generate HTML for PDF
    const currentDate = new Date().toLocaleDateString();
    const safetyFactorPercentage = (safetyFactor * 100).toFixed(0);

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
                line-height: 1.4;
            }
            .header {
                border-bottom: 2px solid #2563eb;
                padding-bottom: 15px;
                margin-bottom: 20px;
            }
            .company-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            .company-name {
                font-size: 24px;
                font-weight: bold;
                color: #2563eb;
            }
            .report-date {
                font-size: 12px;
                color: #666;
            }
            .client-info {
                background: #f8fafc;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
            }
            .client-info h3 {
                margin: 0 0 10px 0;
                color: #2563eb;
            }
            .summary {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-bottom: 25px;
            }
            .summary-card {
                background: #f1f5f9;
                padding: 15px;
                border-radius: 5px;
                text-align: center;
            }
            .summary-value {
                font-size: 20px;
                font-weight: bold;
                color: #2563eb;
            }
            .summary-label {
                font-size: 12px;
                color: #666;
                margin-top: 5px;
            }
            .room-section {
                margin-bottom: 30px;
                page-break-inside: avoid;
            }
            .room-title {
                background: #2563eb;
                color: white;
                padding: 10px 15px;
                margin: 0 0 10px 0;
                font-size: 16px;
                font-weight: bold;
            }
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 15px;
            }
            .items-table th {
                background: #e2e8f0;
                padding: 8px;
                text-align: left;
                font-size: 12px;
                font-weight: bold;
            }
            .items-table td {
                padding: 6px 8px;
                border-bottom: 1px solid #e2e8f0;
                font-size: 11px;
            }
            .room-totals {
                background: #f8fafc;
                padding: 10px;
                font-size: 12px;
                font-weight: bold;
                text-align: right;
            }
            .footer {
                margin-top: 30px;
                padding-top: 15px;
                border-top: 1px solid #e2e8f0;
                font-size: 11px;
                color: #666;
            }
            .safety-note {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                padding: 10px;
                margin-top: 15px;
                border-radius: 4px;
                font-size: 11px;
            }
            .page-break {
                page-break-before: always;
            }
            .photo-gallery {
                page-break-before: always;
                margin-top: 30px;
            }
            .photo-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 40px;
            }
            .photo-item {
                text-align: center;
                page-break-inside: avoid;
            }
            .photo-item img {
                max-width: 100%;
                max-height: 300px;
                border: 1px solid #e2e8f0;
                border-radius: 4px;
            }
            .photo-caption {
                margin-top: 8px;
                font-size: 12px;
                color: #666;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-info">
                <div class="company-name">Inventory Management Report</div>
                <div class="report-date">Generated: ${currentDate}</div>
            </div>
        </div>

        <div class="client-info">
            <h3>Client Information</h3>
            <p><strong>Client Name:</strong> ${clientInfo.clientName}</p>
            <p><strong>City:</strong> ${clientInfo.city}</p>
            ${clientInfo.quoteId ? `<p><strong>Quote ID:</strong> ${clientInfo.quoteId}</p>` : ''}
            <p><strong>Session:</strong> ${session.name || 'Unnamed Session'}</p>
        </div>

        <div class="summary">
            <div class="summary-card">
                <div class="summary-value">${totalItems}</div>
                <div class="summary-label">Total Items</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${totalVolume.toFixed(1)} cu ft</div>
                <div class="summary-label">Total Volume (w/ SF)</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${totalWeight.toFixed(0)} lbs</div>
                <div class="summary-label">Total Weight (w/ SF)</div>
            </div>
        </div>

        ${Object.entries(itemsByRoom).map(([room, roomItems]) => {
          const roomVolume = applyLoadingSafetyFactor(roomItems.reduce((sum, item) => sum + (Number(item.volume) * item.quantity), 0));
          const roomWeight = applyLoadingSafetyFactor(roomItems.reduce((sum, item) => sum + (Number(item.weight) * item.quantity), 0));
          
          return `
            <div class="room-section">
                <h2 class="room-title">${room} (${roomItems.length} items)</h2>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Photo #</th>
                            <th>Qty</th>
                            <th>Volume (cu ft)</th>
                            <th>Weight (lbs)</th>
                            <th>Total Vol</th>
                            <th>Total Weight</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${roomItems.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.found_in_image || 'N/A'}</td>
                                <td>${item.quantity}</td>
                                <td>${Number(item.volume).toFixed(2)}</td>
                                <td>${Number(item.weight).toFixed(1)}</td>
                                <td>${(Number(item.volume) * item.quantity).toFixed(2)}</td>
                                <td>${(Number(item.weight) * item.quantity).toFixed(1)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="room-totals">
                    Room Totals (with ${safetyFactorPercentage}% safety factor): ${roomVolume.toFixed(1)} cu ft | ${roomWeight.toFixed(0)} lbs
                </div>
            </div>
          `;
        }).join('')}

        <div class="footer">
            <p><strong>Report Details:</strong></p>
            <p>• Generated on ${currentDate} for ${clientInfo.clientName}</p>
            <p>• Total inventory items: ${totalItems}</p>
            <p>• Safety factor applied: ${safetyFactorPercentage >= 0 ? '+' : ''}${safetyFactorPercentage}%</p>
            ${images.length > 0 ? `<p>• Based on analysis of ${images.length} uploaded photos</p>` : ''}
        </div>

        <div class="safety-note">
            <strong>Safety Factor Notice:</strong> A ${safetyFactorPercentage}% safety factor has been applied to all volume and weight calculations to account for packing efficiency and potential measurement variations.
        </div>

        ${images.length > 0 ? `
        <div class="photo-gallery">
            <h2 style="color: #2563eb; font-size: 18px; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">Photo Gallery</h2>
            <div class="photo-grid">
                ${images.map((image, index) => `
                    <div class="photo-item">
                        <img src="${supabaseUrl}/storage/v1/object/public/inventory-images/${image.file_path}" alt="Inventory Photo ${index + 1}" />
                        <div class="photo-caption">Photo #${index + 1}</div>
                        <div style="font-size: 10px; color: #888; margin-top: 4px;">
                            ${image.file_name} - ${new Date(image.analyzed_at).toLocaleDateString()}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    </body>
    </html>`;

    // Return HTML that can be printed to PDF by the browser
    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});