-- On its own, because a new enum value can't be used in the transaction that adds it, and
-- the next migration turns count-down timers into countdowns.
ALTER TYPE "ElementType" ADD VALUE 'COUNTDOWN';
