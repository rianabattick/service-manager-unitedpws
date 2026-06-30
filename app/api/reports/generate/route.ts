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
    // 1. We now receive userId from the button!
    const { jobId, unitId, templateId, userId } = await req.json();

    // 2. Fetch the template file path
    const { data: templateData, error: templateError } = await supabase
      .from('report_templates')
      .select('file_path')
      .eq('id', templateId)
      .single();

    if (templateError || !templateData) throw new Error('Template not found');

    // 3. Fetch the job data (we removed the old assigned_to guess here)
    const { data, error: jobError } = await supabase
      .from('jobs')
      .select(`
        scheduled_start,
        actual_start,
        customer:customers!jobs_customer_id_fkey(first_name, last_name, company_name),
        vendor:vendors!jobs_vendor_id_fkey(name),
        service_location:service_locations!jobs_service_location_id_fkey(address, city, state, zip_code),
        job_equipment!inner(
          equipment:equipment!job_equipment_equipment_id_fkey(serial_number)
        ),
        job_contacts(name, phone, email)
      `)
      .eq('id', jobId)
      .eq('job_equipment.equipment_id', unitId)
      .single();

    if (jobError || !data) throw new Error('Job data not found');

    const jobData = data as any; 

    // 4. Fetch Technician Name (The EXACT tech who clicked the button)
    let techName = '';
    if (userId) {
      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();
      
      techName = userData?.full_name || '';
    }
    
    // 5. Logic for Direct vs. Subcontracted, Dates, and Contacts
    const isSubcontracted = !!jobData.vendor;
    const fallbackCustomerName = `${jobData.customer.first_name} ${jobData.customer.last_name}`;
    const finalCompanyName = jobData.customer.company_name || fallbackCustomerName;
    const finalCustomerName = isSubcontracted ? jobData.vendor.name : finalCompanyName;
    
    const rawDate = jobData.actual_start || jobData.scheduled_start;
    const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString() : '';

    const contact = jobData.job_contacts?.[0] || {};

    // 6. Map the tags
    const tagMap: Record<string, string> = {
      '[TECH_NAME]': techName,
      '[JOB_DATE]': formattedDate,
      '[REPORT_CUSTOMER]': finalCustomerName,
      '[REPORT_COMPANY]': finalCompanyName,
      '[CONTACT_NAME]': contact.name || '',
      '[CONTACT_PHONE]': contact.phone || '',
      '[CONTACT_EMAIL]': contact.email || '',
      '[SITE_ADDRESS]': jobData.service_location?.address || '',
      '[SITE_CITY_STATE_ZIP]': `${jobData.service_location?.city || ''}, ${jobData.service_location?.state || ''} ${jobData.service_location?.zip_code || ''}`.trim(),
      '[UNIT_SERIAL]': jobData.job_equipment[0]?.equipment?.serial_number || '',
    };

    // 7. Download the template from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('report_templates')
      .download(templateData.file_path);
    
    if (downloadError) throw new Error('Failed to download template from storage');

    const arrayBuffer = await fileData.arrayBuffer();

    // 8. Open Excel file with xlsx-populate and Replace Tags
    const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);

    workbook.sheets().forEach((sheet: any) => {
      const cells = sheet.find(/./); 
      
      cells.forEach((cell: any) => {
        let cellValue = cell.value();
        
        if (typeof cellValue === 'string') {
          Object.entries(tagMap).forEach(([tag, replacement]) => {
             if (cellValue.includes(tag)) {
                cellValue = cellValue.replace(tag, replacement);
                cell.value(cellValue); 
             }
          });
        }
      });
    });

    // 9. Package and Return the custom file
    const buffer = await workbook.outputAsync();
    
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Report.xlsx"`,
      },
    });

  } catch (error: any) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate report' }, { status: 500 });
  }
}