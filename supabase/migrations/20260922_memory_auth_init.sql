-- ==============================================================================
-- NOKLAI: Simplified Hackathon MVP Schema & Security Policies
-- Clean, robust RLS isolation supporting both custom patient codes ('P001') and UUIDs.
-- ==============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. Remove Redundant Complexity
-- ==============================================================================
DROP TABLE IF EXISTS public.admin_audit_log CASCADE;
DROP TRIGGER IF EXISTS trg_log_admin_memory_mutation ON public.memories;
DROP FUNCTION IF EXISTS public.log_admin_memory_mutation();

DROP TRIGGER IF EXISTS trg_set_default_primary_caregiver ON public.patient_caregiver_links;
DROP FUNCTION IF EXISTS public.set_default_primary_caregiver();
DROP TRIGGER IF EXISTS trg_auto_promote_primary_caregiver ON public.patient_caregiver_links;
DROP FUNCTION IF EXISTS public.auto_promote_primary_caregiver();
DROP FUNCTION IF EXISTS public.transfer_primary_caregiver(uuid, uuid);

-- ==============================================================================
-- 3. Profiles Table (supports 'patient', 'caregiver', 'admin')
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('patient', 'caregiver', 'admin')),
    full_name TEXT NOT NULL,
    phone TEXT,
    preferred_language TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Helper function for high-performance, non-recursive admin checks in RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==============================================================================
-- 4. Patient-Caregiver Links Table (patient_id is TEXT for 'P001' or UUIDs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.patient_caregiver_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    caregiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    relation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_patient_caregiver UNIQUE(patient_id, caregiver_id)
);

-- If the table already existed with UUID type, safely alter to TEXT
ALTER TABLE public.patient_caregiver_links DROP CONSTRAINT IF EXISTS patient_caregiver_links_patient_id_fkey;
ALTER TABLE public.patient_caregiver_links DROP COLUMN IF EXISTS status;
ALTER TABLE public.patient_caregiver_links DROP COLUMN IF EXISTS is_primary;
ALTER TABLE public.patient_caregiver_links ALTER COLUMN patient_id TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_links_patient ON public.patient_caregiver_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_links_caregiver ON public.patient_caregiver_links(caregiver_id);

-- ==============================================================================
-- 5. Memories Table (patient_id is TEXT for 'P001' or UUIDs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    person_name TEXT NOT NULL,
    relation TEXT NOT NULL,
    notes TEXT,
    image_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880),
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png')),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- If table already existed with UUID type, safely drop FK and alter to TEXT
ALTER TABLE public.memories DROP CONSTRAINT IF EXISTS memories_patient_id_fkey;
ALTER TABLE public.memories ALTER COLUMN patient_id TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_memories_patient_active ON public.memories(patient_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_memories_uploaded_by ON public.memories(uploaded_by);

-- Patient quota trigger: Max 150 active photos per patient
CREATE OR REPLACE FUNCTION public.check_patient_photo_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.memories
    WHERE patient_id = NEW.patient_id AND is_deleted = FALSE;

    IF v_count >= 150 THEN
        RAISE EXCEPTION 'Photo limit reached (maximum 150 active photos per patient allowed)';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_patient_photo_limit ON public.memories;
CREATE TRIGGER trg_check_patient_photo_limit
    BEFORE INSERT ON public.memories
    FOR EACH ROW
    EXECUTE FUNCTION public.check_patient_photo_limit();

-- ==============================================================================
-- 6. Atomic User Signup Trigger
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role, full_name, phone, preferred_language)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'NOKLAI User'),
        NEW.raw_user_meta_data->>'phone',
        COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        preferred_language = EXCLUDED.preferred_language,
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 7. Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_caregiver_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- --- PROFILES POLICIES ---
DROP POLICY IF EXISTS "profiles_select_own_or_linked_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_linked_or_admin" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.patient_caregiver_links
            WHERE (patient_id = public.profiles.id::text AND caregiver_id = auth.uid())
               OR (caregiver_id = public.profiles.id AND patient_id = auth.uid()::text)
        )
    );

DROP POLICY IF EXISTS "profiles_insert_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_insert_own_or_admin" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- --- PATIENT-CAREGIVER LINKS POLICIES ---
DROP POLICY IF EXISTS "links_select_involved_or_admin" ON public.patient_caregiver_links;
CREATE POLICY "links_select_involved_or_admin" ON public.patient_caregiver_links
    FOR SELECT USING (
        patient_id = auth.uid()::text OR caregiver_id = auth.uid() OR public.is_admin()
    );

DROP POLICY IF EXISTS "links_insert_involved_or_admin" ON public.patient_caregiver_links;
CREATE POLICY "links_insert_involved_or_admin" ON public.patient_caregiver_links
    FOR INSERT WITH CHECK (
        caregiver_id = auth.uid() OR patient_id = auth.uid()::text OR public.is_admin()
    );

DROP POLICY IF EXISTS "links_update_involved_or_admin" ON public.patient_caregiver_links;
CREATE POLICY "links_update_involved_or_admin" ON public.patient_caregiver_links
    FOR UPDATE USING (
        patient_id = auth.uid()::text OR caregiver_id = auth.uid() OR public.is_admin()
    );

DROP POLICY IF EXISTS "links_delete_involved_or_admin" ON public.patient_caregiver_links;
CREATE POLICY "links_delete_involved_or_admin" ON public.patient_caregiver_links
    FOR DELETE USING (
        patient_id = auth.uid()::text OR caregiver_id = auth.uid() OR public.is_admin()
    );

-- --- MEMORIES POLICIES ---
-- 1. SELECT: Patient themselves, any linked caregiver, or admin.
DROP POLICY IF EXISTS "memories_select_authorized_or_admin" ON public.memories;
CREATE POLICY "memories_select_authorized_or_admin" ON public.memories
    FOR SELECT USING (
        is_deleted = FALSE AND (
            patient_id = auth.uid()::text
            OR public.is_admin()
            OR EXISTS (
                SELECT 1 FROM public.patient_caregiver_links
                WHERE patient_id = public.memories.patient_id
                  AND caregiver_id = auth.uid()
            )
        )
    );

-- 2. INSERT: Patient themselves, any linked caregiver, or admin.
DROP POLICY IF EXISTS "memories_insert_authorized_or_admin" ON public.memories;
CREATE POLICY "memories_insert_authorized_or_admin" ON public.memories
    FOR INSERT WITH CHECK (
        patient_id = auth.uid()::text
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.patient_caregiver_links
            WHERE patient_id = public.memories.patient_id
              AND caregiver_id = auth.uid()
          )
    );

-- 3. UPDATE: Patient themselves, any linked caregiver, or admin.
DROP POLICY IF EXISTS "memories_update_authorized_or_admin" ON public.memories;
CREATE POLICY "memories_update_authorized_or_admin" ON public.memories
    FOR UPDATE USING (
        is_deleted = FALSE AND (
            patient_id = auth.uid()::text
            OR public.is_admin()
            OR EXISTS (
                SELECT 1 FROM public.patient_caregiver_links
                WHERE patient_id = public.memories.patient_id
                  AND caregiver_id = auth.uid()
            )
        )
    );

-- 4. DELETE: Original uploader, any linked caregiver, or admin.
DROP POLICY IF EXISTS "memories_delete_authorized_or_admin" ON public.memories;
CREATE POLICY "memories_delete_authorized_or_admin" ON public.memories
    FOR DELETE USING (
        public.is_admin()
        OR uploaded_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.patient_caregiver_links
            WHERE patient_id = public.memories.patient_id
              AND caregiver_id = auth.uid()
        )
    );
