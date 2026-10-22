import { z } from 'zod';
import { createSchema } from './model.ts';
export const inspectionTools=[
 {name:'create_inspection',description:'Create a move-in or move-out checklist with separate expiring tenant and operator links. Present property, participants, date, mode and checklist for explicit operator approval first. baselineId must be a confirmed move-in for the same lease/property. amendsId preserves the previous confirmed report. Never share the operator link with the tenant. Link possession is not verified identity.',schema:createSchema.extend({approved:z.literal(true)}),path:'',method:'POST'},
 {name:'list_inspections',description:'List the latest 100 inspection IDs, properties, dates, types and statuses. No private bearer links are returned.',schema:z.object({}).strict(),path:'',method:'GET'},
 {name:'revoke_inspection_links',description:'After explicit operator approval, revoke both shared links for an inspection. Keeps the saved report available through the authenticated admin API.',schema:z.object({id:z.string().uuid(),approved:z.literal(true)}).strict(),path:'revoke',method:'POST'},
] as const;
