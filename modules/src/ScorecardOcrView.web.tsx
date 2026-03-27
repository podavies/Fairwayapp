import * as React from "react";

import { ScorecardOcrViewProps } from "./ScorecardOcr.types";

export default function ScorecardOcrView(props: ScorecardOcrViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad?.({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
