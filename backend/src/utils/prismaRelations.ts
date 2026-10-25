// Maps an optional relation id from an update payload to a Prisma nested write:
//   undefined -> leave the relation unchanged
//   null      -> unlink it
//   string    -> link to that record
export function relationUpdate(id: string | null | undefined) {
  if (id === undefined) return undefined;
  return id === null ? { disconnect: true } : { connect: { id } };
}

// Same tri-state handling for optional date fields.
export function optionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}
