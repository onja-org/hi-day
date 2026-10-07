import { SelectField } from "@/components/ui/form/SelectField";
import type { SendReportFileType } from "@/types/sendReport";

type FileTypeSelectProps = {
  label: string;
  value: SendReportFileType;
  onChange: (fileType: SendReportFileType) => void;
};

/** The PDF / CSV choice for a sent or scheduled report. */
export function FileTypeSelect({ label, value, onChange }: FileTypeSelectProps) {
  return (
    <SelectField label={label} value={value} onChange={(event) => onChange(event.target.value as SendReportFileType)}>
      <option value="pdf">PDF</option>
      <option value="csv">CSV</option>
    </SelectField>
  );
}
