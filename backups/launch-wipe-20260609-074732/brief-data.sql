--
-- PostgreSQL database dump
--

\restrict ypk9i9MhixWyCcobeaF2mIET03Q4fHntFoP0nIrtjgfgI10V0WtvfrwaVnXEQxq

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: briefs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.briefs (id, no, slack_ts, slack_channel, slack_url, marka_id, baslik, dept, deadline, saat, durum, priority, priority_label, rev, maliyet, satis, fatura, odeme, musteri_notu, tahmini_sure_h, akis, stale, gecmis, created_at, completed_at, updated_at, image_url, deleted_at, deleted_by) FROM stdin;
2	2	1780580278.428099	C08N311GBHP	https://benseno.slack.com/archives/C08N311GBHP/p1780580278428099	21	deneme 6	\N	\N	\N	yeni	\N	\N	0	100	\N	f	f	deneme iyi denem 6	\N	sirali	f	\N	2026-06-04 13:37:58.252554+00	\N	2026-06-04 13:37:58.495316+00	\N	\N	\N
3	3	1780580513.512869	C4Y43AW2E	https://benseno.slack.com/archives/C4Y43AW2E/p1780580513512869	2	deneme 7	editor,tasarim	2026-06-05 14:00:00+00	\N	yeni	\N	\N	0	100	\N	f	f	deneem 7	\N	sirali	f	\N	2026-06-04 13:41:53.308491+00	\N	2026-06-04 13:41:53.581483+00	\N	\N	\N
4	4	1780636369.538489	C4Y43AW2E	https://benseno.slack.com/archives/C4Y43AW2E/p1780636369538489	2	deneme cuma	tasarim	2026-06-08 14:00:00+00	\N	yeni	\N	\N	0	\N	\N	f	f	www.benseno.com.tr\ndeneme cok deneme	\N	sirali	f	\N	2026-06-05 05:12:49.184375+00	\N	2026-06-05 05:12:49.606268+00	\N	\N	\N
9	8	1780639821.350179	C4Y43AW2E	https://benseno.slack.com/archives/C4Y43AW2E/p1780639821350179	2	deneme	editor	\N	\N	yeni	\N	\N	0	\N	\N	f	f	deneme cok deneme	\N	sirali	f	\N	2026-06-05 06:10:21.023739+00	\N	2026-06-08 13:25:29.854145+00	\N	2026-06-08 13:25:29.854145+00	U030C48PL23
6	5	1780638561.989869	C4Y43AW2E	https://benseno.slack.com/archives/C4Y43AW2E/p1780638561989869	2	gercek is baslıgı	editor	2026-06-08 07:00:00+00	\N	yeni	\N	\N	0	\N	\N	f	f	denem nasıl oluyor	\N	sirali	f	\N	2026-06-05 05:49:21.739206+00	\N	2026-06-05 05:49:22.071036+00	\N	\N	\N
7	6	1780638901.674149	C4Y43AW2E	https://benseno.slack.com/archives/C4Y43AW2E/p1780638901674149	2	yeni iş deneme	editor	\N	\N	yeni	\N	\N	0	\N	\N	f	f	yeni is	\N	sirali	f	\N	2026-06-05 05:55:01.453908+00	\N	2026-06-05 05:55:01.741973+00	\N	\N	\N
8	7	1780639260.874509	C4Y43AW2E	https://benseno.slack.com/archives/C4Y43AW2E/p1780639260874509	2	gercek deneme işi	editor,tasarim	2026-06-09 06:00:00+00	\N	yeni	\N	\N	0	\N	\N	f	f	deneme iyi deneme	\N	sirali	f	\N	2026-06-05 06:01:00.704353+00	\N	2026-06-05 06:01:00.963656+00	\N	\N	\N
10	9	1780639984.191639	C4Y43AW2E	https://benseno.slack.com/archives/C4Y43AW2E/p1780639984191639	2	banner tasarımları	tasarim	2026-06-10 06:12:00+00	\N	yeni	\N	\N	0	\N	\N	f	f	ne zaman nasıl oalcak	\N	sirali	f	\N	2026-06-05 06:13:03.953122+00	\N	2026-06-05 06:13:04.432487+00	\N	\N	\N
12	11	1780640646.966709	C4Y43AW2E	https://benseno.slack.com/archives/C4Y43AW2E/p1780640646966709	2	Reklam görselleri calsıma	editor	2026-06-11 06:23:00+00	\N	yeni	\N	\N	0	\N	\N	f	f	deneme iyi denem	\N	sirali	f	\N	2026-06-05 06:24:06.716217+00	\N	2026-06-05 06:24:07.333555+00	\N	\N	\N
1	1	1780580187.623509	C08N311GBHP	https://benseno.slack.com/archives/C08N311GBHP/p1780580187623509	21	deneme 5	editor,tasarim	2026-06-05 17:00:00+00	\N	yeni	\N	\N	0	\N	\N	f	f	deneme cok deneme 5	\N	sirali	f	\N	2026-06-04 13:36:27.305076+00	\N	2026-06-05 12:29:08.309319+00	\N	\N	\N
15	14	1780895412.498399	C0A5CEXDGC9	https://benseno.slack.com/archives/C0A5CEXDGC9/p1780895412498399	51	test	editor,tasarim	2026-06-09 05:09:00+00	\N	incelemede	\N	\N	0	\N	\N	f	f	test test	\N	sirali	f	\N	2026-06-08 05:10:12.274353+00	\N	2026-06-08 05:24:22.471548+00	\N	\N	\N
14	13	1780661460.728829	C0ANY1ZMH2A	https://benseno.slack.com/archives/C0ANY1ZMH2A/p1780661460728829	10	deneme	editor	\N	\N	tamamlandi	\N	\N	0	\N	\N	f	f	cok is cok	\N	sirali	f	\N	2026-06-05 12:11:00.52776+00	2026-06-05 10:19:56.445445+00	2026-06-08 10:19:56.445445+00	\N	\N	\N
16	15	1780917652.940299	C0A5CEXDGC9	https://benseno.slack.com/archives/C0A5CEXDGC9/p1780917652940299	51	demo	tasarim	\N	\N	yeni	\N	\N	0	\N	\N	f	f	\N	\N	sirali	f	\N	2026-06-08 11:20:52.709187+00	\N	2026-06-08 13:10:53.743755+00	\N	\N	\N
11	10	1780640308.245689	C4Y43AW2E	https://benseno.slack.com/archives/C4Y43AW2E/p1780640308245689	2	bauhaus reklam görselleri	editor	2026-06-10 06:17:00+00	\N	yeni	\N	\N	0	\N	\N	f	f	deneme cok iyi deneme	\N	sirali	f	\N	2026-06-05 06:18:27.942634+00	\N	2026-06-08 13:22:57.999844+00	\N	\N	\N
13	12	1780660995.078619	C0ANY1ZMH2A	https://benseno.slack.com/archives/C0ANY1ZMH2A/p1780660995078619	10	test test	ai	2026-06-11 14:00:00+00	\N	tamamlandi	\N	\N	0	100	300	f	f	test the test	\N	sirali	f	\N	2026-06-05 12:03:14.921578+00	2026-06-05 10:19:56.445445+00	2026-06-08 13:23:02.547375+00	https://files.slack.com/files-pri/T4Y3R6RAN-F0B9D7UKTPA/202605061036_615783824.jpg	\N	\N
18	17	1780923655.089889	C4Y43AW2E	https://benseno.slack.com/archives/C4Y43AW2E/p1780923655089889	2	demo 2	editor,tasarim	2026-06-15 13:00:00+00	\N	yeni	\N	\N	0	\N	\N	f	f	\N	\N	sirali	f	\N	2026-06-08 13:00:54.913249+00	\N	2026-06-08 13:24:25.129316+00	\N	2026-06-08 13:24:25.129316+00	slack:deleted
17	16	1780923094.996029	C4Y43AW2E	https://benseno.slack.com/archives/C4Y43AW2E/p1780923094996029	2	demo	tasarim	2026-06-15 12:47:00+00	\N	yeni	\N	\N	0	\N	\N	f	f	demo demo	\N	sirali	f	\N	2026-06-08 12:51:34.795572+00	\N	2026-06-08 13:24:37.548697+00	\N	2026-06-08 13:24:37.548697+00	slack:deleted
\.


--
-- Data for Name: brief_approvals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.brief_approvals (id, brief_id, approver_id, sira, durum, ts) FROM stdin;
\.


--
-- Data for Name: brief_assignees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.brief_assignees (id, brief_id, user_id, role, sira) FROM stdin;
3	1	U4XCE3532	lead	0
4	1	U030C48PL23	gozlemci	0
5	1	U4XCE3532	gozlemci	1
6	1	U055EDESLSE	gozlemci	2
7	1	U02SZQDAFPF	gozlemci	3
8	2	U030C48PL23	contributor	0
9	2	U0AP31SAA1W	lead	0
10	2	U09BZHR25NG	gozlemci	0
11	3	U055EDESLSE	contributor	0
12	3	U07PV0RA9L2	contributor	1
13	3	U4XCE3532	lead	0
14	3	U08NQJ27G5S	gozlemci	0
15	3	U05PP70GQTX	gozlemci	1
16	3	U4XCE3532	gozlemci	2
17	3	U055EDESLSE	gozlemci	3
18	3	U02SZQDAFPF	gozlemci	4
19	4	U055EDESLSE	contributor	0
20	4	U030C48PL23	lead	0
21	4	U4XCE3532	gozlemci	0
22	4	U055EDESLSE	gozlemci	1
25	6	U4XCE3532	contributor	0
26	6	UD96GH76E	contributor	1
27	6	U055EDESLSE	lead	0
28	6	U063T8M5HL4	gozlemci	0
29	6	U4XCE3532	gozlemci	1
30	6	U02SZQDAFPF	gozlemci	2
31	7	U4XCE3532	contributor	0
32	7	U030C48PL23	lead	0
33	7	U4XCE3532	gozlemci	0
34	7	U02SZQDAFPF	gozlemci	1
35	8	U4XCE3532	contributor	0
36	8	U055EDESLSE	contributor	1
37	8	U030C48PL23	lead	0
38	8	U0AP31SAA1W	gozlemci	0
39	8	U4XCE3532	gozlemci	1
40	8	U055EDESLSE	gozlemci	2
41	8	U02SZQDAFPF	gozlemci	3
42	9	U4XCE3532	contributor	0
43	9	U030C48PL23	lead	0
44	9	U4XCE3532	gozlemci	0
45	9	U02SZQDAFPF	gozlemci	1
46	10	U055EDESLSE	contributor	0
47	10	UD96GH76E	contributor	1
48	10	U055EDESLSE	lead	0
49	10	U4XCE3532	lead	1
50	10	U030C48PL23	gozlemci	0
51	10	U055EDESLSE	gozlemci	1
52	11	U02SZQDAFPF	contributor	0
53	11	U055EDESLSE	lead	0
54	11	U063T8M5HL4	lead	1
55	11	UD96GH76E	gozlemci	0
56	11	U02SZQDAFPF	gozlemci	1
57	11	U4XCE3532	gozlemci	2
58	12	U02SZQDAFPF	contributor	0
59	12	U4XCE3532	contributor	1
60	12	U030C48PL23	lead	0
61	12	U4XCE3532	gozlemci	0
62	12	U02SZQDAFPF	gozlemci	1
63	13	U0AP31SAA1W	contributor	0
64	13	U030C48PL23	lead	0
65	13	U07PV0RA9L2	gozlemci	0
66	14	U4XCE3532	contributor	0
67	14	U030C48PL23	lead	0
68	14	U02SZQDAFPF	gozlemci	0
69	1	U06J26R1XCJ	contributor	0
70	1	U05PP70GQTX	contributor	1
74	15	U02SZQDAFPF	contributor	0
75	15	U055EDESLSE	contributor	1
76	15	U4XCE3532	lead	0
77	15	U05PP70GQTX	gozlemci	0
80	16	U06J26R1XCJ	contributor	0
81	16	U030C48PL23	lead	0
82	16	U030C48PL23	gozlemci	0
83	17	U06J26R1XCJ	contributor	0
84	17	U030C48PL23	lead	0
85	17	U030C48PL23	gozlemci	0
86	18	U06J26R1XCJ	contributor	0
87	18	U063T8M5HL4	contributor	1
88	18	U02SZQDAFPF	lead	0
89	18	U4XCE3532	gozlemci	0
\.


--
-- Data for Name: brief_attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.brief_attachments (id, brief_id, url, filename, mime, uploaded_by, source, ts) FROM stdin;
1	1	https://benseno.slack.com/files/U0B5AGDEZRN/F0B8C5CBSGH/202605061036_615783824.jpg	202605061036_615783824.jpg	\N	U030C48PL23	slack	2026-06-04 13:36:29.296656+00
2	2	https://benseno.slack.com/files/U0B5AGDEZRN/F0B86ULENE9/202605061036_615783824.jpg	202605061036_615783824.jpg	image/jpeg	U030C48PL23	slack	2026-06-04 13:38:02.29058+00
3	3	https://benseno.slack.com/files/U0B5AGDEZRN/F0B8E0A3RGC/202605061036_615783824.jpg	202605061036_615783824.jpg	image/jpeg	U030C48PL23	slack	2026-06-04 13:41:57.305913+00
4	4	https://benseno.slack.com/files/U0B5AGDEZRN/F0B8EADM0AJ/202605061036_615783824.jpg	202605061036_615783824.jpg	image/jpeg	U030C48PL23	slack	2026-06-05 05:12:52.531778+00
5	6	https://benseno.slack.com/files/U0B5AGDEZRN/F0B8D68UNMB/202605061036_615783824.jpg	202605061036_615783824.jpg	\N	U030C48PL23	slack	2026-06-05 05:49:23.59107+00
6	8	https://benseno.slack.com/files/U0B5AGDEZRN/F0B815R3B8F/202605061036_615783824.jpg	202605061036_615783824.jpg	\N	U030C48PL23	slack	2026-06-05 06:01:02.286339+00
7	10	https://benseno.slack.com/files/U0B5AGDEZRN/F0B8AAL8EEP/202605061036_615783824.jpg	202605061036_615783824.jpg	\N	U030C48PL23	slack	2026-06-05 06:13:05.413409+00
8	11	https://benseno.slack.com/files/U0B5AGDEZRN/F0B8DB3FKK7/202605061036_615783824.jpg	202605061036_615783824.jpg	\N	U030C48PL23	slack	2026-06-05 06:18:29.70078+00
9	12	https://benseno.slack.com/files/U0B5AGDEZRN/F0B8EME0D5L/202605061036_615783824.jpg	202605061036_615783824.jpg	\N	U030C48PL23	slack	2026-06-05 06:24:08.578246+00
10	13	https://benseno.slack.com/files/U0B5AGDEZRN/F0B9D7UKTPA/202605061036_615783824.jpg	202605061036_615783824.jpg	image/jpeg	U030C48PL23	slack	2026-06-05 12:03:18.567873+00
11	15	https://benseno.slack.com/files/U0B5AGDEZRN/F0B8XTY9DFU/202605061036_615783824.jpg	202605061036_615783824.jpg	\N	U030C48PL23	slack	2026-06-08 05:10:14.227089+00
\.


--
-- Data for Name: brief_tags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.brief_tags (id, brief_id, tag) FROM stdin;
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.events (id, brief_id, user_id, verb, detail, source, slack_ts, ts) FROM stdin;
1	1	U030C48PL23	olusturuldu	{"no": 1, "marka": "Cimporglobal", "baslik": "deneme 5"}	dashboard	\N	2026-06-04 13:36:27.305076+00
2	1	\N	slack:gönderildi	{"ts": "1780580187.623509", "channel": "C08N311GBHP"}	system	\N	2026-06-04 13:36:27.715942+00
3	2	U030C48PL23	olusturuldu	{"no": 2, "marka": "Cimporglobal", "baslik": "deneme 6"}	dashboard	\N	2026-06-04 13:37:58.252554+00
4	2	\N	slack:gönderildi	{"ts": "1780580278.428099", "channel": "C08N311GBHP"}	system	\N	2026-06-04 13:37:58.498766+00
5	3	U030C48PL23	olusturuldu	{"no": 3, "marka": "Bauhaus", "baslik": "deneme 7"}	dashboard	\N	2026-06-04 13:41:53.308491+00
6	3	\N	slack:gönderildi	{"ts": "1780580513.512869", "channel": "C4Y43AW2E"}	system	\N	2026-06-04 13:41:53.585115+00
7	4	U030C48PL23	olusturuldu	{"no": 4, "marka": "Bauhaus", "baslik": "deneme cuma"}	dashboard	\N	2026-06-05 05:12:49.184375+00
8	4	\N	slack:gönderildi	{"ts": "1780636369.538489", "channel": "C4Y43AW2E"}	system	\N	2026-06-05 05:12:49.609971+00
12	6	U030C48PL23	olusturuldu	{"no": 5, "marka": "Bauhaus", "baslik": "gercek is baslıgı"}	dashboard	\N	2026-06-05 05:49:21.739206+00
13	6	\N	slack:gönderildi	{"ts": "1780638561.989869", "channel": "C4Y43AW2E"}	system	\N	2026-06-05 05:49:22.074815+00
14	7	U030C48PL23	olusturuldu	{"no": 6, "marka": "Bauhaus", "baslik": "yeni iş deneme"}	dashboard	\N	2026-06-05 05:55:01.453908+00
15	7	\N	slack:gönderildi	{"ts": "1780638901.674149", "channel": "C4Y43AW2E"}	system	\N	2026-06-05 05:55:01.745448+00
16	8	U030C48PL23	olusturuldu	{"no": 7, "marka": "Bauhaus", "baslik": "gercek deneme işi"}	dashboard	\N	2026-06-05 06:01:00.704353+00
17	8	\N	slack:gönderildi	{"ts": "1780639260.874509", "channel": "C4Y43AW2E"}	system	\N	2026-06-05 06:01:00.967038+00
18	9	U030C48PL23	olusturuldu	{"no": 8, "marka": "Bauhaus", "baslik": "deneme"}	dashboard	\N	2026-06-05 06:10:21.023739+00
19	9	\N	slack:gönderildi	{"ts": "1780639821.350179", "channel": "C4Y43AW2E"}	system	\N	2026-06-05 06:10:21.627106+00
20	10	U030C48PL23	olusturuldu	{"no": 9, "marka": "Bauhaus", "baslik": "banner tasarımları"}	dashboard	\N	2026-06-05 06:13:03.953122+00
21	10	\N	slack:gönderildi	{"ts": "1780639984.191639", "channel": "C4Y43AW2E"}	system	\N	2026-06-05 06:13:04.437988+00
22	11	U030C48PL23	olusturuldu	{"no": 10, "marka": "Bauhaus", "baslik": "bauhaus reklam görselleri"}	dashboard	\N	2026-06-05 06:18:27.942634+00
23	11	\N	slack:gönderildi	{"ts": "1780640308.245689", "channel": "C4Y43AW2E"}	system	\N	2026-06-05 06:18:28.475005+00
24	12	U030C48PL23	olusturuldu	{"no": 11, "marka": "Bauhaus", "baslik": "Reklam görselleri calsıma"}	dashboard	\N	2026-06-05 06:24:06.716217+00
25	12	\N	slack:gönderildi	{"ts": "1780640646.966709", "channel": "C4Y43AW2E"}	system	\N	2026-06-05 06:24:07.337789+00
26	13	U030C48PL23	olusturuldu	{"no": 12, "marka": "Egosport", "baslik": "test test"}	dashboard	\N	2026-06-05 12:03:14.921578+00
27	13	\N	slack:gönderildi	{"ts": "1780660995.078619", "channel": "C0ANY1ZMH2A"}	system	\N	2026-06-05 12:03:15.338426+00
28	14	U030C48PL23	olusturuldu	{"no": 13, "marka": "Egosport", "baslik": "deneme"}	dashboard	\N	2026-06-05 12:11:00.52776+00
29	14	\N	slack:gönderildi	{"ts": "1780661460.728829", "channel": "C0ANY1ZMH2A"}	system	\N	2026-06-05 12:11:01.030738+00
30	13	U030C48PL23	durum:incelemede	{"durum": "incelemede"}	slack	\N	2026-06-05 12:11:17.739675+00
31	1	U030C48PL23	düzenlendi	{"alanlar": ["worker_ids"]}	dashboard	\N	2026-06-05 12:29:08.309319+00
33	15	U030C48PL23	olusturuldu	{"no": 14, "marka": "KZY Flamingo", "baslik": "test"}	dashboard	\N	2026-06-08 05:10:12.274353+00
34	15	\N	slack:gönderildi	{"ts": "1780895412.498399", "channel": "C0A5CEXDGC9"}	system	\N	2026-06-08 05:10:12.744117+00
38	15	U030C48PL23	durum:incelemede	{"durum": "incelemede"}	slack	\N	2026-06-08 05:24:22.471548+00
39	16	U030C48PL23	olusturuldu	{"no": 15, "marka": "KZY Flamingo", "baslik": "demo"}	dashboard	\N	2026-06-08 11:20:52.709187+00
40	16	\N	slack:gönderildi	{"ts": "1780917652.940299", "channel": "C0A5CEXDGC9"}	system	\N	2026-06-08 11:20:53.306927+00
41	16	U030C48PL23	silindi	{}	slack	\N	2026-06-08 12:27:22.47328+00
42	16	U030C48PL23	geri alındı	{}	dashboard	\N	2026-06-08 12:27:24.420542+00
43	13	\N	silindi	{}	slack	\N	2026-06-08 12:42:15.627197+00
44	11	\N	silindi	{}	slack	\N	2026-06-08 12:42:40.140781+00
45	17	U030C48PL23	olusturuldu	{"no": 16, "marka": "Bauhaus", "baslik": "demo"}	dashboard	\N	2026-06-08 12:51:34.795572+00
46	17	\N	slack:gönderildi	{"ts": "1780923094.996029", "channel": "C4Y43AW2E"}	system	\N	2026-06-08 12:51:35.29605+00
47	18	U030C48PL23	olusturuldu	{"no": 17, "marka": "Bauhaus", "baslik": "demo 2"}	dashboard	\N	2026-06-08 13:00:54.913249+00
48	18	\N	slack:gönderildi	{"ts": "1780923655.089889", "channel": "C4Y43AW2E"}	system	\N	2026-06-08 13:00:55.376716+00
49	18	U030C48PL23	silindi	{}	slack	\N	2026-06-08 13:08:22.220688+00
50	16	U030C48PL23	silindi	{}	slack	\N	2026-06-08 13:10:51.898352+00
51	16	U030C48PL23	geri alındı	{}	dashboard	\N	2026-06-08 13:10:53.747554+00
52	11	U030C48PL23	geri alındı	{}	dashboard	\N	2026-06-08 13:22:58.004693+00
53	13	U030C48PL23	geri alındı	{}	dashboard	\N	2026-06-08 13:23:02.551225+00
54	18	U030C48PL23	geri alındı	{}	dashboard	\N	2026-06-08 13:23:06.695808+00
55	18	\N	silindi	{}	slack	\N	2026-06-08 13:24:25.134351+00
56	17	\N	silindi	{}	slack	\N	2026-06-08 13:24:37.552146+00
57	9	U030C48PL23	silindi	{}	slack	\N	2026-06-08 13:25:29.859772+00
\.


--
-- Name: brief_approvals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.brief_approvals_id_seq', 1, false);


--
-- Name: brief_assignees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.brief_assignees_id_seq', 89, true);


--
-- Name: brief_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.brief_attachments_id_seq', 11, true);


--
-- Name: brief_tags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.brief_tags_id_seq', 1, false);


--
-- Name: briefs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.briefs_id_seq', 18, true);


--
-- Name: events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.events_id_seq', 57, true);


--
-- PostgreSQL database dump complete
--

\unrestrict ypk9i9MhixWyCcobeaF2mIET03Q4fHntFoP0nIrtjgfgI10V0WtvfrwaVnXEQxq

