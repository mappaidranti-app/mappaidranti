-- Modifica tabella municipalities per supportare 2 referenti ufficiali
ALTER TABLE public.municipalities
ADD COLUMN province VARCHAR(255),
ADD COLUMN notes TEXT,
ADD COLUMN ref1_name VARCHAR(255),
ADD COLUMN ref1_role VARCHAR(255),
ADD COLUMN ref1_phone VARCHAR(255),
ADD COLUMN ref1_email VARCHAR(255),
ADD COLUMN ref2_name VARCHAR(255),
ADD COLUMN ref2_role VARCHAR(255),
ADD COLUMN ref2_phone VARCHAR(255),
ADD COLUMN ref2_email VARCHAR(255);
