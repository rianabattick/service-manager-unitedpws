import { createClient } from "@/lib/supabase-server";
import { Card } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";
import { DownloadBlankButton } from "@/components/DownloadBlankButton";
import { PageHeader } from "@/components/shared/PageHeader";

export default async function TemplatesPage() {
  const supabase = await createClient();
  
  // Fetch all templates for the list
  const { data: templates } = await supabase
    .from("report_templates")
    .select("id, name")
    .order("name");

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Blank Report Templates" 
        subtitle="Download blank report templates to fill out manually." 
      />

      {/* Vertical List Section */}
      <div className="flex flex-col gap-4">
        {templates?.map((template) => (
          <Card key={template.id} className="flex flex-row items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-2 rounded-md">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{template.name}</h3>
                <p className="text-sm text-muted-foreground">Excel Spreadsheet (.xlsx)</p>
              </div>
            </div>
            
            {/* Download Button container */}
            <div>
              <DownloadBlankButton templateId={template.id} templateName={template.name} />
            </div>
          </Card>
        ))}
        
        {/* Fallback if no templates exist yet */}
        {(!templates || templates.length === 0) && (
          <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
            No templates have been uploaded to the database yet.
          </div>
        )}
      </div>
    </div>
  );
}