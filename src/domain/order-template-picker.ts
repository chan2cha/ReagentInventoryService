export type OrderTemplateSearchCandidate = {
  name: string;
  description?: string | null;
  items: ReadonlyArray<{
    allergen: {
      code: string;
      name: string;
    };
  }>;
};

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLowerCase();
}

/**
 * Matches a template against the text shown in the template picker. Both the
 * query and candidate text are normalized so compatibility characters behave
 * consistently regardless of how either value was entered.
 */
export function matchesOrderTemplateQuery(template: OrderTemplateSearchCandidate, query: string) {
  const normalizedQuery = normalizeSearchText(query).trim();

  if (!normalizedQuery) {
    return true;
  }

  if (
    normalizeSearchText(template.name).includes(normalizedQuery) ||
    (template.description !== null &&
      template.description !== undefined &&
      normalizeSearchText(template.description).includes(normalizedQuery))
  ) {
    return true;
  }

  return template.items.some(
    (item) =>
      normalizeSearchText(item.allergen.code).includes(normalizedQuery) ||
      normalizeSearchText(item.allergen.name).includes(normalizedQuery)
  );
}
