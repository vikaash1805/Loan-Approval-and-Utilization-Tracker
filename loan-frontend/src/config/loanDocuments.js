import { Home, Car, GraduationCap, Briefcase, UserCheck } from "lucide-react";

/**
 * Standardized Loan Document Configuration
 * Strictly adheres to enterprise loan-type specific requirements:
 *
 * 1. HOME LOAN:
 *    - Aadhaar (Required)
 *    - PAN (Required)
 *    - Address Proof (Required)
 *    - Photograph (Required)
 *    - Salary Slips / Income Proof (Required)
 *    - Form 16 / ITR (Required)
 *    - Bank Statement (Required)
 *    - Property Documents (Required)
 *    - Sale Agreement / Sale Deed (Required)
 *    - Property Approval / Tax Documents where applicable (Optional)
 *
 * 2. PERSONAL LOAN:
 *    - Aadhaar (Required)
 *    - PAN (Required)
 *    - Address Proof (Required)
 *    - Photograph (Required)
 *    - Salary Slips / Income Proof (Required)
 *    - Bank Statement (Required)
 *    - Form 16 / ITR (Required)
 *    - Employment Proof where applicable (Optional)
 *
 * 3. BUSINESS LOAN:
 *    - Aadhaar (Required)
 *    - PAN (Required)
 *    - Address Proof (Required)
 *    - Photograph (Required)
 *    - Business Registration Certificate (Required)
 *    - GST Certificate (Required)
 *    - GST Returns (Required)
 *    - ITR (Required)
 *    - Bank Statement (Required)
 *    - Balance Sheet (Required)
 *    - Profit & Loss Statement (Required)
 *    - Business Address Proof (Required)
 *
 * 4. EDUCATION LOAN:
 *    Student:
 *    - Aadhaar (Required)
 *    - PAN where applicable (Optional)
 *    - Admission Letter (Required)
 *    - Academic Certificates / Marksheets (Required)
 *    - Fee Structure (Required)
 *    Parent / Co-borrower:
 *    - Aadhaar (Required)
 *    - PAN (Required)
 *    - Income Proof (Required)
 *    - Bank Statement (Required)
 *    Additional:
 *    - Collateral Documents where applicable (Optional)
 *
 * 5. VEHICLE LOAN:
 *    - Aadhaar (Required)
 *    - PAN (Required)
 *    - Address Proof (Required)
 *    - Photograph (Required)
 *    - Salary Slips / Income Proof (Required)
 *    - Bank Statement (Required)
 *    - ITR where applicable (Optional)
 *    - Vehicle Quotation (Required)
 *    - Proforma Invoice / Booking Receipt (Required)
 *    - Insurance / Vehicle Documents where applicable (Optional)
 */

export const LOAN_DOCUMENTS_CONFIG = {
  Home: {
    loan_type: "Home",
    title: "Home Loan Document Checklist",
    description: "Please upload official property title records, municipal tax proofs, income statements, and identification documents for your Home Loan underwriting.",
    icon: Home,
    badgeColor: "#0891B2",
    badgeBg: "#ECFEFF",
    docs: [
      {
        id: "aadhaar",
        label: "Aadhaar",
        description: "Official 12-digit Aadhaar Card with visible UID, photograph, name and address",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
        is_kyc: true,
      },
      {
        id: "pan",
        label: "PAN",
        description: "Official 10-character Permanent Account Number (PAN) Card",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
        is_kyc: true,
      },
      {
        id: "address_proof",
        label: "Address Proof",
        description: "Utility bill (electricity, water, piped gas), passport, voter ID, or registered rent agreement",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "photograph",
        label: "Photograph",
        description: "Recent passport-size color photograph of primary applicant",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "salary_income_proof",
        label: "Salary Slips / Income Proof",
        description: "Latest 3 months salary payslips or certified income proof",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "form16_itr",
        label: "Form 16 / ITR",
        description: "Form 16 (Part A & B) or Income Tax Returns for the last 2 financial years",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "bank_statement",
        label: "Bank Statement",
        description: "Latest 6 months salary / operative savings bank account statement",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "property_documents",
        label: "Property Documents",
        description: "Title deed chain, builder allotment letter, or possession letter",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "sale_agreement_deed",
        label: "Sale Agreement / Sale Deed",
        description: "Registered sale agreement, registered sale deed, or conveyance deed",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "property_approval_tax",
        label: "Property Approval / Tax Documents where applicable",
        description: "Sanctioned building plan, occupancy certificate (OC), property tax receipt, or Khata extract",
        required: false,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
    ],
  },

  Personal: {
    loan_type: "Personal",
    title: "Personal Loan Document Checklist",
    description: "Please upload personal identification, address proof, income statements, and employment credentials for your Personal Loan.",
    icon: UserCheck,
    badgeColor: "#10B981",
    badgeBg: "#ECFDF5",
    docs: [
      {
        id: "aadhaar",
        label: "Aadhaar",
        description: "Valid 12-digit Aadhaar Card with matching name and date of birth",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
        is_kyc: true,
      },
      {
        id: "pan",
        label: "PAN",
        description: "Official 10-character Permanent Account Number (PAN) Card",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
        is_kyc: true,
      },
      {
        id: "address_proof",
        label: "Address Proof",
        description: "Valid Passport, Voter ID card, or recent utility bill (last 2 months)",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "photograph",
        label: "Photograph",
        description: "Recent passport-size color photograph of applicant",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "salary_income_proof",
        label: "Salary Slips / Income Proof",
        description: "Last 3 months official monthly salary slips",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "bank_statement",
        label: "Bank Statement",
        description: "Last 6 months salary bank account statement reflecting salary credits",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "form16_itr",
        label: "Form 16 / ITR",
        description: "Latest Form 16 Part A & B or Income Tax Return acknowledgment",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "employment_proof",
        label: "Employment Proof where applicable",
        description: "Corporate Employee ID Card, appointment letter, or official company work verification",
        required: false,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
    ],
  },

  Business: {
    loan_type: "Business",
    title: "Business Loan Document Checklist",
    description: "Please upload official statutory business registrations, GST filings, balance sheets, and audited tax returns for your Business Loan.",
    icon: Briefcase,
    badgeColor: "#F59E0B",
    badgeBg: "#FEF3C7",
    docs: [
      {
        id: "aadhaar",
        label: "Aadhaar",
        description: "Valid 12-digit Aadhaar Card of the proprietor / primary partner / authorized director",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
        is_kyc: true,
      },
      {
        id: "pan",
        label: "PAN",
        description: "PAN Card of the primary promoter and/or business entity",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
        is_kyc: true,
      },
      {
        id: "address_proof",
        label: "Address Proof",
        description: "Personal residential address proof of the promoter / director",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "photograph",
        label: "Photograph",
        description: "Recent passport-size color photograph of primary business applicant",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "business_registration",
        label: "Business Registration Certificate",
        description: "Certificate of Incorporation (COI), Partnership Deed, MSME Udyam, or Shop & Establishment License",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "gst_certificate",
        label: "GST Certificate",
        description: "GST Registration Certificate (Form GST REG-06) showing principal place of business",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "gst_returns",
        label: "GST Returns",
        description: "GSTR-3B / GSTR-1 filings for the last 6 to 12 months",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "itr",
        label: "ITR",
        description: "Income Tax Returns with computation of income for the last 2 assessment years",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "bank_statement",
        label: "Bank Statement",
        description: "Current account commercial bank statements for the last 12 months",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "balance_sheet",
        label: "Balance Sheet",
        description: "Audited / CA certified Balance Sheet for the last 2 financial years",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "profit_loss",
        label: "Profit & Loss Statement",
        description: "Audited / CA certified Profit & Loss statement for the last 2 financial years",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "business_address_proof",
        label: "Business Address Proof",
        description: "Office/factory rent agreement or commercial utility bill in the registered business name",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
    ],
  },

  Education: {
    loan_type: "Education",
    title: "Education Loan Document Checklist",
    description: "Please upload academic credentials, admission confirmation, and co-borrower/parent financial documents for your Education Loan.",
    icon: GraduationCap,
    badgeColor: "#A855F7",
    badgeBg: "#FAF5FF",
    docs: [
      // ─── Student Documents ───
      {
        id: "student_aadhaar",
        label: "Aadhaar",
        section: "Student",
        description: "Valid 12-digit Aadhaar Card of the student borrower",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
        is_kyc: true,
      },
      {
        id: "student_pan",
        label: "PAN where applicable",
        section: "Student",
        description: "10-character PAN Card of the student borrower (where applicable)",
        required: false,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
        is_kyc: true,
      },
      {
        id: "admission_letter",
        label: "Admission Letter",
        section: "Student",
        description: "Official unconditional / conditional admission offer letter from the recognized institution",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "academic_certificates",
        label: "Academic Certificates / Marksheets",
        section: "Student",
        description: "Class 10th, 12th marksheets, degree certificate / semester grade cards, and entrance scorecards",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "fee_structure",
        label: "Fee Structure",
        section: "Student",
        description: "Official institute tuition fee schedule, hostel expenses, and examination fee estimate",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },

      // ─── Parent / Co-borrower Documents ───
      {
        id: "parent_aadhaar",
        label: "Aadhaar",
        section: "Parent / Co-borrower",
        description: "Valid 12-digit Aadhaar Card of parent or co-borrower / financial guarantor",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "parent_pan",
        label: "PAN",
        section: "Parent / Co-borrower",
        description: "Official 10-character PAN Card of parent or co-borrower",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "parent_income_proof",
        label: "Income Proof",
        section: "Parent / Co-borrower",
        description: "Latest 3 months salary slips, Form 16, or last 2 years ITR of the parent/co-borrower",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "parent_bank_statement",
        label: "Bank Statement",
        section: "Parent / Co-borrower",
        description: "Last 6 months operative bank account statement of the parent or co-borrower",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },

      // ─── Additional Documents ───
      {
        id: "collateral_documents",
        label: "Collateral Documents where applicable",
        section: "Additional",
        description: "Property title documents, fixed deposit receipt, or security pledge where applicable",
        required: false,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
    ],
  },

  Vehicle: {
    loan_type: "Vehicle",
    title: "Vehicle Loan Document Checklist",
    description: "Please upload vehicle quotation, dealer booking receipt, personal ID, and income documentation for your Vehicle Loan.",
    icon: Car,
    badgeColor: "#6366F1",
    badgeBg: "#EEF2FF",
    docs: [
      {
        id: "aadhaar",
        label: "Aadhaar",
        description: "Valid 12-digit Aadhaar Card of the applicant",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
        is_kyc: true,
      },
      {
        id: "pan",
        label: "PAN",
        description: "Official 10-character Permanent Account Number (PAN) Card",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
        is_kyc: true,
      },
      {
        id: "address_proof",
        label: "Address Proof",
        description: "Utility bill, Voter ID, Driving License, or Passport showing current residence",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "photograph",
        label: "Photograph",
        description: "Recent passport-size color photograph of applicant",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "salary_income_proof",
        label: "Salary Slips / Income Proof",
        description: "Latest 3 months salary payslips or business income proof",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "bank_statement",
        label: "Bank Statement",
        description: "Last 6 months operative bank account statement reflecting regular income",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "itr",
        label: "ITR where applicable",
        description: "Form 16 or Income Tax Return acknowledgment where applicable",
        required: false,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "vehicle_quotation",
        label: "Vehicle Quotation",
        description: "Authorized dealership official price quotation on showroom letterhead",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "proforma_invoice",
        label: "Proforma Invoice / Booking Receipt",
        description: "Authorized Dealer Proforma Invoice or initial vehicle booking advance receipt",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
      {
        id: "vehicle_insurance",
        label: "Insurance / Vehicle Documents where applicable",
        description: "Motor insurance cover note, comprehensive policy copy, or existing RC copy if used vehicle",
        required: false,
        accept: ".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf",
      },
    ],
  },
};
