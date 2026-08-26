-- Clean up legacy permissions from financial tracker project (BUDGET, TRANSACTION, WALLET, REPORT)
DELETE FROM "role_permissions" WHERE "permission_id" IN (
    SELECT "id" FROM "permissions" WHERE "resource" IN ('BUDGET', 'TRANSACTION', 'WALLET', 'REPORT')
);

DELETE FROM "permissions" WHERE "resource" IN ('BUDGET', 'TRANSACTION', 'WALLET', 'REPORT');
