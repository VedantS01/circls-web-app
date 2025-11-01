-- Migration to prevent removal of the last staff_manager in an organization

-- Function to check if there's at least one staff_manager remaining
CREATE OR REPLACE FUNCTION public.check_last_staff_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff_manager_count INT;
BEGIN
  -- Only check on UPDATE or DELETE
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
    -- Count remaining staff_managers for this organization
    SELECT COUNT(*)
    INTO _staff_manager_count
    FROM public.organization_memberships
    WHERE organization_id = OLD.organization_id
      AND 'staff_manager' = ANY(permissions)
      AND id != OLD.id; -- Exclude the current row being modified/deleted

    -- If updating and removing staff_manager permission
    IF TG_OP = 'UPDATE' THEN
      -- Check if we're removing staff_manager from this row
      IF 'staff_manager' = ANY(OLD.permissions) 
         AND NOT ('staff_manager' = ANY(NEW.permissions)) THEN
        -- If this is the last staff_manager, prevent the change
        IF _staff_manager_count = 0 THEN
          RAISE EXCEPTION 'Cannot remove the last staff_manager from the organization';
        END IF;
      END IF;
      RETURN NEW;
    END IF;

    -- If deleting
    IF TG_OP = 'DELETE' THEN
      -- Check if we're deleting a staff_manager
      IF 'staff_manager' = ANY(OLD.permissions) THEN
        -- If this is the last staff_manager, prevent the deletion
        IF _staff_manager_count = 0 THEN
          RAISE EXCEPTION 'Cannot delete the last staff_manager from the organization';
        END IF;
      END IF;
      RETURN OLD;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to enforce the constraint
DROP TRIGGER IF EXISTS trg_prevent_last_staff_manager ON public.organization_memberships;

CREATE TRIGGER trg_prevent_last_staff_manager
BEFORE UPDATE OR DELETE ON public.organization_memberships
FOR EACH ROW EXECUTE PROCEDURE public.check_last_staff_manager();

COMMENT ON FUNCTION public.check_last_staff_manager() IS 'Ensures at least one staff_manager remains in each organization';
