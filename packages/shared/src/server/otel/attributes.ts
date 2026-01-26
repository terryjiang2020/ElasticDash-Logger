export enum LangfuseOtelSpanAttributes {
  // ElasticDash-Trace attributes
  TRACE_NAME = "elasticdash.trace.name",
  TRACE_USER_ID = "user.id",
  TRACE_SESSION_ID = "session.id",
  TRACE_TAGS = "elasticdash.trace.tags",
  TRACE_PUBLIC = "elasticdash.trace.public",
  TRACE_METADATA = "elasticdash.trace.metadata",
  TRACE_INPUT = "elasticdash.trace.input",
  TRACE_OUTPUT = "elasticdash.trace.output",

  // ElasticDash-observation attributes
  OBSERVATION_TYPE = "elasticdash.observation.type",
  OBSERVATION_METADATA = "elasticdash.observation.metadata",
  OBSERVATION_LEVEL = "elasticdash.observation.level",
  OBSERVATION_STATUS_MESSAGE = "elasticdash.observation.status_message",
  OBSERVATION_INPUT = "elasticdash.observation.input",
  OBSERVATION_OUTPUT = "elasticdash.observation.output",

  // ElasticDash-observation of type Generation attributes
  OBSERVATION_COMPLETION_START_TIME = "elasticdash.observation.completion_start_time",
  OBSERVATION_MODEL = "elasticdash.observation.model.name",
  OBSERVATION_MODEL_PARAMETERS = "elasticdash.observation.model.parameters",
  OBSERVATION_USAGE_DETAILS = "elasticdash.observation.usage_details",
  OBSERVATION_COST_DETAILS = "elasticdash.observation.cost_details",
  OBSERVATION_PROMPT_NAME = "elasticdash.observation.prompt.name",
  OBSERVATION_PROMPT_VERSION = "elasticdash.observation.prompt.version",

  //   General
  ENVIRONMENT = "elasticdash.environment",
  RELEASE = "elasticdash.release",
  VERSION = "elasticdash.version",

  // Internal
  AS_ROOT = "elasticdash.internal.as_root",

  // Compatibility - Map properties that were documented in https://langfuse.com/docs/opentelemetry/get-started#property-mapping,
  // but have a new assignment
  TRACE_COMPAT_USER_ID = "elasticdash.user.id",
  TRACE_COMPAT_SESSION_ID = "elasticdash.session.id",

  // Experiment attributes
  EXPERIMENT_ID = "elasticdash.experiment.id",
  EXPERIMENT_NAME = "elasticdash.experiment.name",
  EXPERIMENT_METADATA = "elasticdash.experiment.metadata",
  EXPERIMENT_DESCRIPTION = "elasticdash.experiment.description",
  EXPERIMENT_DATASET_ID = "elasticdash.experiment.dataset.id",
  EXPERIMENT_ITEM_ID = "elasticdash.experiment.item.id",
  EXPERIMENT_ITEM_VERSION = "elasticdash.experiment.item.version",
  EXPERIMENT_ITEM_METADATA = "elasticdash.experiment.item.metadata",
  EXPERIMENT_ITEM_ROOT_OBSERVATION_ID = "elasticdash.experiment.item.root_observation_id",
  EXPERIMENT_ITEM_EXPECTED_OUTPUT = "elasticdash.experiment.item.expected_output",
}
