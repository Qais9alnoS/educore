-- Migration: Update existing student payments to have 'completed' status
-- This fixes the issue where payments were created with 'pending' status
-- and weren't being counted in balance calculations

-- Update all existing payments with 'pending' status to 'completed'
UPDATE student_payments 
SET payment_status = 'completed' 
WHERE payment_status = 'pending' OR payment_status IS NULL;

-- Verify the update
SELECT 
    COUNT(*) as total_payments,
    SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) as completed_payments,
    SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending_payments
FROM student_payments;
