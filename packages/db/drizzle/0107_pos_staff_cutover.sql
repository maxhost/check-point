-- Spec0242: additive compatibility cutover, no activation or owner elevation.
-- Re-runnable; preserve every existing permission and its order.
UPDATE core.business_membership AS member
SET permissions = array_append(member.permissions, 'pos')
WHERE member.role = 'staff'
  AND member.status = 'active'
  AND 'counter' = ANY(member.permissions)
  AND NOT ('pos' = ANY(member.permissions))
  AND EXISTS (
    SELECT 1 FROM core.business_module AS module
    WHERE module.business_id = member.business_id
      AND module.module_id = 'pos'
      AND module.enabled = true
  );
