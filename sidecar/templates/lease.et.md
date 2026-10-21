# ELURUUMI ÜÜRILEPING nr {{lease.number}}

Sõlmitud {{today}} elektrooniliselt.

## 1. Lepingu pooled

**Üürileandja:** {{owner.name}}, registrikood {{owner.regCode}}, aadress {{owner.address}}, keda esindab {{owner.representative}} (edaspidi „Üürileandja“).

**Üürnik:** {{tenant.name}}, isikukood {{tenant.personalCode}}, e-post {{tenant.email}}{{#if tenant.phone}}, telefon {{tenant.phone}}{{/if}} (edaspidi „Üürnik“).

## 2. Lepingu ese

2.1. Üürileandja annab Üürnikule tasu eest kasutada eluruumi aadressil **{{unit.address}}**{{#if unit.apartmentNo}}, korter {{unit.apartmentNo}}{{/if}}{{#if unit.areaM2}}, üldpind {{unit.areaM2}} m²{{/if}}{{#if unit.rooms}}, tubade arv {{unit.rooms}}{{/if}} (edaspidi „Eluruum“).

2.2. Eluruum antakse üle koos sisustuse ja seadmetega, mis on loetletud üleandmise-vastuvõtmise aktis. Akt on lepingu lahutamatu lisa ning see koostatakse Eluruumi üleandmisel koos arvestite näitudega.

2.3. Eluruumi kasutatakse üksnes elamiseks. Eluruumis elavad Üürnik ja temaga koos elavad isikud, kelle Üürnik on Üürileandjale kirjalikult teatanud.

## 3. Lepingu kehtivus

{{#if lease.endDate}}3.1. Leping on sõlmitud tähtajaliselt ajavahemikuks {{lease.startDate}} kuni {{lease.endDate}}.{{else}}3.1. Leping on sõlmitud tähtajatult ning kehtib alates {{lease.startDate}}.{{/if}}

3.2. Tähtajatu lepingu võib kumbki pool korraliselt üles öelda, teatades sellest teisele poolele vähemalt {{lease.noticeDays}} päeva ette kirjalikku taasesitamist võimaldavas vormis, arvestades võlaõigusseaduse (VÕS) §-des 312 ja 313 sätestatut. Tähtajalise lepingu erakorraline ülesütlemine toimub VÕS-is sätestatud alustel.

## 4. Üür ja maksmise kord

4.1. Üüri suurus on **{{lease.rent}} kuus**. Üürilepingust tulenev üür on käibemaksuvaba (KMS § 16 lg 2 p 1).

4.2. Üür tasutakse ette iga kalendrikuu eest hiljemalt kuu {{lease.dueDay}}. kuupäevaks Üürileandja esitatud arve alusel. Arved esitatakse ja tasutakse makseteenuse CasaPay kaudu Üürniku e-posti aadressile saadetud makselingiga (kaardimakse, pangalink või pangaülekanne).

4.3. Kui leping algab või lõpeb kalendrikuu keskel, arvestatakse selle kuu üür proportsionaalselt kasutatud päevadega.

4.4. Maksega viivitamisel on Üürileandjal õigus nõuda viivist VÕS § 113 sätestatud määras.

## 5. Kõrvalkulud

5.1. {{lease.utilitiesText}}

5.2. Kõrvalkulude arved (nt korteriühistu arve, elekter, vesi, küte, gaas) esitatakse Üürnikule tegelike kulude alusel CasaPay kaudu. Üürnikul on õigus tutvuda kõrvalkulude aluseks olevate dokumentidega.

## 6. Tagatis

6.1. Üürnik tagab lepingust tulenevate kohustuste täitmise tagatisega summas **{{lease.deposit}}** (ei ületa kolme kuu üüri, VÕS § 300).

6.2. {{lease.depositText}}

6.3. Tagatisraha tagastatakse mõistliku aja jooksul pärast lepingu lõppemist ja Eluruumi tagastamist, arvestades maha Üürileandja põhjendatud nõuded.

## 7. Poolte kohustused

7.1. Üürnik kohustub kasutama Eluruumi heaperemehelikult ja sihtotstarbeliselt, järgima korteriühistu kodukorda, tegema Eluruumi tavapäraseks kasutamiseks vajalikke väiksemaid parandustöid ning teatama Üürileandjale viivitamata Eluruumis tekkinud puudustest.

7.2. Üürnik ei tohi anda Eluruumi allüürile ega teha Eluruumis ümberehitusi ilma Üürileandja kirjaliku nõusolekuta. Lemmikloomade pidamine ja suitsetamine Eluruumis on lubatud üksnes Üürileandja kirjalikul nõusolekul.

7.3. Üürileandja kohustub andma Eluruumi üle lepingutingimustele vastavas seisukorras, tegema vajalikud suuremad parandustööd ning tagama Üürniku häirimatu kasutamise. Üürileandjal on õigus mõistliku etteteatamisega Eluruumi üle vaadata.

## 8. Eluruumi tagastamine

8.1. Lepingu lõppemisel tagastab Üürnik Eluruumi koos kõigi võtmete ja sisustusega seisukorras, mis vastab tavapärasele kulumisele. Tagastamise kohta koostatakse üleandmise-vastuvõtmise akt koos arvestite lõppnäitudega.

## 9. Lõppsätted

9.1. Lepingus reguleerimata küsimustes lähtuvad pooled Eesti Vabariigi õigusaktidest, eelkõige võlaõigusseadusest.

9.2. Teated edastatakse lepingus märgitud e-posti aadressidele. Vaidlused lahendatakse läbirääkimiste teel, kokkuleppe mittesaavutamisel üürikomisjonis (kui see on olemas) või Harju Maakohtus.

9.3. Üürileandja töötleb Üürniku isikuandmeid lepingu täitmise eesmärgil ning edastab need makseteenuse osutajale (CasaPay) arvete esitamiseks ja maksete vastuvõtmiseks.

9.4. Leping allkirjastatakse elektrooniliselt. Allkirjastamise andmed (aeg, IP-aadress, dokumendi räsi) on esitatud lepingu allkirjade lehel.

{{#if lease.specialTerms}}
## 10. Eritingimused

{{lease.specialTerms}}
{{/if}}
