import { requirePageRole } from "@/lib/auth";
import { formatKoreaDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { listOrderTemplates } from "@/services/order-template-service";
import { RegistrationDialog } from "@/app/registration-dialog";
import { SubmitButton } from "@/app/submit-button";
import { AppShell } from "@/app/reagent-ui";
import { TableSearch } from "@/app/table-search";
import { setOrderTemplateActive } from "./actions";
import { OrderTemplateForm, type TemplateAllergenOption } from "./order-template-form";

export const dynamic = "force-dynamic";

export default async function OrderTemplatesPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; success?: string; q?: string }>;
}) {
  await requirePageRole(["ADMIN", "ORDER_MANAGER"]);
  const params = await searchParams;
  const query = params?.q?.trim();
  const [templates, allergens] = await Promise.all([
    listOrderTemplates(prisma, { includeInactive: true, q: query }),
    prisma.allergen.findMany({
      select: { id: true, code: true, name: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { category: "asc" }, { code: "asc" }]
    })
  ]);
  const allergenOptions: TemplateAllergenOption[] = allergens;

  return (
    <AppShell
      active="/orders/templates"
      title="주문 세트 관리"
      description="자주 주문하는 시약과 기본 수량을 공용 세트로 저장합니다."
    >
      {params?.error ? <div className="page-alert">{params.error}</div> : null}
      {params?.success ? <div className="page-alert success">{params.success}</div> : null}

      <div className="template-management-toolbar">
        <TableSearch
          pathname="/orders/templates"
          placeholder="세트명, 설명, 시약 코드·이름 검색"
          value={query}
        />
        <RegistrationDialog
          dialogClassName="template-management-dialog"
          title="주문 세트 등록"
          triggerLabel="새 주문 세트"
        >
          <OrderTemplateForm allergens={allergenOptions} />
        </RegistrationDialog>
      </div>

      <section className="template-management-summary" aria-label="주문 세트 요약">
        <div><span>조회된 세트</span><strong>{templates.length}</strong></div>
        <div><span>활성 세트</span><strong>{templates.filter((template) => template.isActive).length}</strong></div>
        <p>세트를 주문 등록 화면에서 담은 뒤에도 품목과 수량을 자유롭게 수정할 수 있습니다.</p>
      </section>

      {templates.length ? (
        <section className="template-management-list" aria-label="주문 세트 목록">
          {templates.map((template) => {
            const totalQuantity = template.items.reduce((sum, item) => sum + item.quantity, 0);
            const inactiveItems = template.items.filter((item) => !item.allergen.isActive);

            return (
              <article className={`template-management-card${template.isActive ? "" : " inactive"}`} key={template.id}>
                <header>
                  <div>
                    <div className="template-management-title">
                      <h2>{template.name}</h2>
                      <span className={`status-badge ${template.isActive ? "ok" : "muted"}`}>
                        {template.isActive ? "활성" : "비활성"}
                      </span>
                    </div>
                    <p>{template.description || "설명 없음"}</p>
                  </div>
                  <dl>
                    <div><dt>품목</dt><dd>{template.items.length}종</dd></div>
                    <div><dt>총수량</dt><dd>{totalQuantity}개</dd></div>
                  </dl>
                </header>

                <ol className="template-management-items">
                  {template.items.map((item) => (
                    <li className={item.allergen.isActive ? "" : "inactive"} key={item.id}>
                      <span>{item.allergen.code} · {item.allergen.name}</span>
                      <strong>{item.quantity}개</strong>
                      {!item.allergen.isActive ? <em>비활성 시약</em> : null}
                    </li>
                  ))}
                </ol>

                {inactiveItems.length ? (
                  <p className="template-management-warning">
                    비활성 시약 {inactiveItems.length}종이 포함되어 주문 등록에 사용할 수 없습니다. 품목을 수정하세요.
                  </p>
                ) : null}

                <footer>
                  <span>최근 수정 {formatKoreaDateTime(template.updatedAt)} · 버전 {template.version}</span>
                  <div className="template-management-actions">
                    <RegistrationDialog
                      dialogClassName="template-management-dialog"
                      showPlus={false}
                      title={`${template.name} 수정`}
                      triggerClassName="secondary-button dialog-trigger"
                      triggerLabel="수정"
                    >
                      <OrderTemplateForm
                        allergens={allergenOptions}
                        template={{
                          id: template.id,
                          version: template.version,
                          name: template.name,
                          description: template.description ?? "",
                          items: template.items.map((item) => ({
                            allergenId: item.allergenId,
                            quantity: item.quantity
                          }))
                        }}
                      />
                    </RegistrationDialog>
                    <form action={setOrderTemplateActive}>
                      <input name="templateId" type="hidden" value={template.id} />
                      <input name="expectedVersion" type="hidden" value={template.version} />
                      <input name="isActive" type="hidden" value={String(!template.isActive)} />
                      <SubmitButton
                        className={template.isActive ? "table-action danger" : "table-action"}
                        confirmMessage={`${template.name} 세트를 ${template.isActive ? "비활성화" : "활성화"}하시겠습니까?`}
                        pendingLabel="변경 중..."
                      >
                        {template.isActive ? "비활성화" : "활성화"}
                      </SubmitButton>
                    </form>
                  </div>
                </footer>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="template-management-empty">
          <strong>{query ? "검색 결과가 없습니다." : "등록된 주문 세트가 없습니다."}</strong>
          <p>{query ? "다른 검색어로 다시 확인하세요." : "새 주문 세트를 등록해 반복 입력을 줄여보세요."}</p>
        </div>
      )}
    </AppShell>
  );
}
