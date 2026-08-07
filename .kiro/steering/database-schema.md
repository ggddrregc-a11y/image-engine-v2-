# Supabase Database Schema

**Project URL:** `https://irwhkqrpexblmrhfalge.supabase.co`

---

## الجداول الموجودة

### 1. `credit_settings`
| العمود | النوع |
|--------|-------|
| id | string |
| initial_credits | number |
| generate_cost | number |
| edit_cost | number |
| updated_at | timestamp |

---

### 2. `collections`
| العمود | النوع |
|--------|-------|
| id | string |
| name | string |
| description | string |
| created_at | timestamp |

---

### 3. `generation_jobs`
| العمود | النوع |
|--------|-------|
| id | string |
| prompt | string |
| model | string |
| status | string |
| progress | number |
| current_node | string |
| provider_id | string |
| started_at | timestamp |
| completed_at | timestamp |
| eta_seconds | number |
| error_message | string |
| image_url | string |
| created_at | timestamp |

---

### 4. `support_links`
| العمود | النوع |
|--------|-------|
| id | string |
| label | string |
| url | string |
| icon | string |
| sort_order | number |

---

### 5. `collection_images`
| العمود | النوع |
|--------|-------|
| id | string |
| collection_id | string |
| image_id | string |
| added_at | timestamp |

---

### 6. `stored_images`
| العمود | النوع |
|--------|-------|
| id | string |
| url | string |
| prompt | string |
| model | string |
| width | number |
| height | number |
| favorite | boolean |
| tags | array |
| created_at | timestamp |

---

### 7. `users`
| العمود | النوع |
|--------|-------|
| id | string |
| email | string |
| created_at | timestamp |
| credits | number |
| role | string |

---

### 8. `prompt_templates`
| العمود | النوع |
|--------|-------|
| id | string |
| name | string |
| prompt_text | string |
| category | string |
| negative_prompt | string |
| created_at | timestamp |
| updated_at | timestamp |

---

### 9. `banner_config`
| العمود | النوع |
|--------|-------|
| id | string |
| enabled | boolean |
| text | string |
| cta_text | string |
| cta_url | string |
| icon | string |
| color | string |

---

### 10. `api_keys`
| العمود | النوع |
|--------|-------|
| id | string |
| key | string |
| name | string |
| created_at | timestamp |
| last_used | timestamp |
| enabled | boolean |

---

### 11. `generation_settings`
| العمود | النوع |
|--------|-------|
| id | string |
| width | number |
| height | number |
| cfg | number |
| sampler | string |
| scheduler | string |
| seed | number |
| steps | number |
| batch_count | number |
| batch_size | number |
| negative_prompt | string |
| safety_filter | boolean |
| watermark | boolean |
| save_metadata | boolean |
| updated_at | timestamp |

---

## ملاحظات
- قاعدة البيانات من نوع PostgreSQL عبر Supabase
- الـ API متاح على: `https://irwhkqrpexblmrhfalge.supabase.co/rest/v1/`
- Authentication يتم عبر Service Role Key في الـ headers
