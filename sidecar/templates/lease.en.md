# RESIDENTIAL LEASE AGREEMENT No. {{lease.number}}

> Starter template: complete and review the terms for your market before use.

Concluded electronically on {{today}}.

## 1. Parties

**Landlord:** {{owner.name}}, registry code {{owner.regCode}}, address {{owner.address}}, represented by {{owner.representative}} (the "Landlord").

**Tenant:** {{tenant.name}}, personal code {{tenant.personalCode}}, e-mail {{tenant.email}}{{#if tenant.phone}}, phone {{tenant.phone}}{{/if}} (the "Tenant").

## 2. Subject of the agreement

2.1. The Landlord grants the Tenant, for a fee, the use of the dwelling at **{{unit.address}}**{{#if unit.apartmentNo}}, apartment {{unit.apartmentNo}}{{/if}}{{#if unit.areaM2}}, area {{unit.areaM2}} m²{{/if}}{{#if unit.rooms}}, {{unit.rooms}} rooms{{/if}} (the "Dwelling").

2.2. The Dwelling is handed over together with the furniture and appliances listed in the handover act, which forms an integral annex to this agreement and records the meter readings.

2.3. The Dwelling is used for residential purposes only, by the Tenant and the persons notified to the Landlord in writing.

## 3. Term

{{#if lease.endDate}}3.1. This agreement is concluded for a fixed term from {{lease.startDate}} until {{lease.endDate}}.{{else}}3.1. This agreement is concluded for an unspecified term, effective from {{lease.startDate}}.{{/if}}

3.2. Termination notice is {{lease.noticeDays}} days, subject to the applicable law and any additional terms agreed below.

## 4. Rent and payment

4.1. The rent is **{{lease.rent}} per month**. Any applicable tax treatment must be specified in the special terms and reflected in invoices.

4.2. Rent is paid in advance for each calendar month no later than day {{lease.dueDay}} of the month, based on the Landlord's invoice. Invoices are issued and paid via the CasaPay payment service using the payment link sent to the Tenant's e-mail (card, bank link or bank transfer).

4.3. If the agreement begins or ends mid-month, rent for that month is pro-rated by days.

4.4. Any late-payment charges must be agreed in the special terms and permitted by applicable law.

## 5. Utilities and service charges

5.1. {{lease.utilitiesText}}

5.2. Utility invoices (building management, electricity, water, heating, gas) are re-billed to the Tenant at actual cost via CasaPay. The Tenant may review the underlying documents.

## 6. Security deposit

6.1. The agreed security deposit is **{{lease.deposit}}**, subject to applicable law.

6.2. {{lease.depositText}}

6.3. The deposit is returned within a reasonable time after the agreement ends and the Dwelling is returned, less the Landlord's justified claims.

## 7. Obligations

7.1. The Tenant shall use the Dwelling with due care and for its intended purpose, follow the house rules, carry out minor repairs needed for ordinary use, and promptly notify the Landlord of defects.

7.2. The Tenant shall not sublet the Dwelling or make alterations without the Landlord's written consent. Pets and smoking are permitted only with the Landlord's written consent.

7.3. The Landlord shall hand over the Dwelling in a condition conforming to this agreement, carry out major repairs, and ensure the Tenant's quiet enjoyment. The Landlord may inspect the Dwelling with reasonable notice.

## 8. Return of the Dwelling

8.1. On termination the Tenant returns the Dwelling with all keys and furnishings in a condition corresponding to normal wear and tear. A handover act with final meter readings is drawn up.

## 9. Final provisions

9.1. Specify the governing law and jurisdiction in the special terms before using this agreement.

9.2. Notices are sent to the e-mail addresses stated above. Specify the applicable dispute-resolution procedure in the special terms.

9.3. The Landlord processes the Tenant's personal data to perform this agreement and shares it with the payment service provider (CasaPay) for invoicing and payments.

9.4. This agreement is signed electronically. Signing details (time, IP address, document hash) are listed on the signature page.

{{#if lease.specialTerms}}
## 10. Special terms

{{lease.specialTerms}}
{{/if}}
