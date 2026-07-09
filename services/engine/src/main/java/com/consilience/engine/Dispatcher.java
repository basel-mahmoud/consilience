package com.consilience.engine;

/** Forwards an approved run to the mesh for research. */
public interface Dispatcher {
  void dispatch(RunRequested message) throws Exception;
}
