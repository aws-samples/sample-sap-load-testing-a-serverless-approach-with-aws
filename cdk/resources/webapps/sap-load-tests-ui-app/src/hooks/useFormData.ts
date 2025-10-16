import { useState, useCallback } from 'react';

interface FormData {
  testType: string;
  testName: string;
  sapSID: string;
  enableAnalytics: boolean;
  k6File: File | null;
  K6Options: string;
  delayms: string;
  duration: string;
}

const initialFormData: FormData = {
  testType: "application",
  testName: "",
  k6File: null,
  K6Options: "",
  sapSID: "",
  enableAnalytics: false,
  delayms: "",
  duration: "",
};

export const useFormData = () => {
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const updateFormData = useCallback((updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const resetFormData = useCallback(() => {
    setFormData(initialFormData);
  }, []);

  const handleInputChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { id, value, type } = event.target;
    updateFormData({
      [id]: type === "checkbox" 
        ? (event.target as HTMLInputElement).checked 
        : value,
    });
  }, [updateFormData]);

  return {
    formData,
    updateFormData,
    resetFormData,
    handleInputChange,
  };
};

export type { FormData };
