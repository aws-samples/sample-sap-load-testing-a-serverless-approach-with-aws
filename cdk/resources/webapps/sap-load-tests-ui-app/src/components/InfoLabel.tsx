import React from "react";
import FieldInfoTooltip from "./FieldInfoTooltip";

interface InfoLabelProps {
  label: string;
  required?: boolean;
  description: string;
}

const InfoLabel: React.FC<InfoLabelProps> = ({
  label,
  required = false,
  description,
}) => {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {label} {required && <span className="text-danger">*</span>}
      <FieldInfoTooltip description={description} />
    </div>
  );
};

export default InfoLabel;
