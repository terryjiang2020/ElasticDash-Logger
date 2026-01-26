CREATE TABLE features ON CLUSTER default (
    `id` String,
    `project_id` String,
    `name` String,
    `description` Nullable(String),
    `created_at` DateTime64(3) DEFAULT now(),
    `updated_at` DateTime64(3) DEFAULT now(),
    INDEX idx_project_id project_id TYPE bloom_filter() GRANULARITY 1,
    INDEX idx_name name TYPE bloom_filter() GRANULARITY 1
) ENGINE = ReplicatedReplacingMergeTree(created_at)
PRIMARY KEY (
    project_id,
    name
)
ORDER BY (
    project_id,
    name,
    id
);
