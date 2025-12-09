-- Create service_pricing table
CREATE TABLE IF NOT EXISTS public.service_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT UNIQUE NOT NULL,
  service_name TEXT NOT NULL,
  base_price INTEGER NOT NULL, -- Price in cents
  rush_fee INTEGER DEFAULT 0, -- Rush service fee in cents
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.service_pricing ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for pricing display)
CREATE POLICY "Allow public read access to active pricing"
  ON public.service_pricing
  FOR SELECT
  USING (is_active = true);

-- Allow admin full access
CREATE POLICY "Allow admin full access to pricing"
  ON public.service_pricing
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE id = auth.uid()
    )
  );

-- Insert default pricing
INSERT INTO public.service_pricing (service_type, service_name, base_price, rush_fee, description) VALUES
  ('claim_readiness_review', 'Claim Readiness Review', 22500, 0, 'Comprehensive analysis of your VA disability claim'),
  ('aid_attendance', 'Aid & Attendance Evaluation', 200000, 50000, 'Complete Aid & Attendance medical evaluation'),
  ('nexus_letter', 'Nexus Letter', 150000, 50000, 'Medical nexus letter for service connection'),
  ('dbq_completion', 'DBQ Completion', 80000, 30000, 'Disability Benefits Questionnaire completion'),
  ('medical_opinion', 'Medical Opinion Letter', 120000, 40000, 'Comprehensive medical opinion letter'),
  ('cp_exam_prep', 'C&P Exam Preparation', 50000, 20000, 'Compensation & Pension exam preparation'),
  ('claim_1151', '1151 Claim Support', 200000, 50000, 'Medical support for 1151 claims')
ON CONFLICT (service_type) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_service_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_pricing_updated_at
  BEFORE UPDATE ON public.service_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_service_pricing_updated_at();
