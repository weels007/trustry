/**
 * What the interface expects from the Trustry contract.
 *
 * This is the contract as the browser sees it. The integration test compares
 * it against the schema the GenVM linter reads out of the contract source, so
 * a change to the contract that the interface has not caught up with fails
 * the build rather than failing at runtime.
 */

export type ParamType = "string" | "address" | "int" | "bool";

export type MethodSpec = {
  /** The name the contract exposes. */
  name: string;
  /** The parameters, in order, with the type the contract declares. */
  params: { name: string; type: ParamType }[];
  /** A read only method does not change state. */
  readonly: boolean;
  /** A payable method can take value. */
  payable: boolean;
};

export const TRUSTRY_METHODS: MethodSpec[] = [
  {
    name: "open_case",
    params: [
      { name: "event_id", type: "string" },
      { name: "event_description", type: "string" },
      { name: "evidence_url", type: "string" },
      { name: "expected_event_title", type: "string" },
    ],
    readonly: false,
    payable: false,
  },
  {
    name: "fund_escrow",
    params: [{ name: "event_id", type: "string" }],
    readonly: false,
    payable: true,
  },
  { name: "notarize", params: [{ name: "event_id", type: "string" }], readonly: false, payable: false },
  {
    name: "appeal_notarization",
    params: [{ name: "event_id", type: "string" }],
    readonly: false,
    payable: false,
  },
  {
    name: "release_escrow",
    params: [
      { name: "event_id", type: "string" },
      { name: "recipient", type: "address" },
    ],
    readonly: false,
    payable: false,
  },
  {
    name: "refund_escrow",
    params: [{ name: "event_id", type: "string" }],
    readonly: false,
    payable: false,
  },
  {
    name: "get_record",
    params: [{ name: "event_id", type: "string" }],
    readonly: true,
    payable: false,
  },
  {
    name: "get_frontend_details",
    params: [{ name: "event_id", type: "string" }],
    readonly: true,
    payable: false,
  },
  {
    name: "get_escrow_status",
    params: [{ name: "event_id", type: "string" }],
    readonly: true,
    payable: false,
  },
  {
    name: "get_escrow_pool",
    params: [{ name: "addr", type: "address" }],
    readonly: true,
    payable: false,
  },
  {
    name: "get_event_count",
    params: [{ name: "addr", type: "address" }],
    readonly: true,
    payable: false,
  },
  { name: "get_all_record_ids", params: [], readonly: true, payable: false },
  { name: "get_total_escrow_held", params: [], readonly: true, payable: false },
  { name: "get_contract_balance", params: [], readonly: true, payable: false },
  {
    name: "is_trusted_domain",
    params: [{ name: "url", type: "string" }],
    readonly: true,
    payable: false,
  },
];

/** The methods the interface calls, in the order the flow uses them. */
export const TRUSTRY_FLOW = [
  "open_case",
  "fund_escrow",
  "notarize",
  "release_escrow",
  "refund_escrow",
  "appeal_notarization",
] as const;

export function findMethod(name: string): MethodSpec | undefined {
  return TRUSTRY_METHODS.find((method) => method.name === name);
}
