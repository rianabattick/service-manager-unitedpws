import { NextResponse } from 'next/server';
// @ts-ignore
import XlsxPopulate from 'xlsx-populate';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { templateId } = await req.json();

    // 1. Fetch the template file path
    const { data: templateData, error: templateError } = await supabase
      .from('report_templates')
      .select('file_path, name')
      .eq('id', templateId)
      .single();

    if (templateError || !templateData) throw new Error('Template not found');

    // 2. Download the template from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('report_templates')
      .download(templateData.file_path);
    
    if (downloadError) throw new Error('Failed to download template from storage');

    const arrayBuffer = await fileData.arrayBuffer();

    // 3. Open Excel file and strip out the tags
    const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);

    workbook.sheets().forEach((sheet: any) => {
      // Find every cell that has any text in it
      const cells = sheet.find(/./); 
      
      cells.forEach((cell: any) => {
        let cellValue = cell.value();
        
        if (typeof cellValue === 'string') {
          // This Regex looks for ANYTHING inside brackets [ ] and replaces it with empty space
          if (/\[.*?\]/.test(cellValue)) {
            const scrubbedValue = cellValue.replace(/\[.*?\]/g, '');
            cell.value(scrubbedValue); 
          }
        }
      });
    });

    // 4. Package and Return the blank file
    const buffer = await workbook.outputAsync();
    
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Blank_${templateData.name}.xlsx"`,
      },
    });

  } catch (error: any) {
    console.error("Error generating blank report:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate blank report' }, { status: 500 });
  }
}