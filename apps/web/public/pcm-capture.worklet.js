class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const channel = inputs[0]?.[0];
    if (channel?.length) this.port.postMessage(channel.slice());
    for (const output of outputs) {
      for (const outputChannel of output) outputChannel.fill(0);
    }
    return true;
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor);
