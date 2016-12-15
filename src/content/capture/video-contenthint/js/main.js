/*
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';

var srcVideo = document.getElementById('srcVideo');
var fluidVideo = document.getElementById('fluidVideo');
var detailedVideo = document.getElementById('detailedVideo');

var srcStream;
var fluidStream;
var detailedStream;

var offerOptions = {
  offerToReceiveAudio: 0,
  offerToReceiveVideo: 1
};

function maybeCreateStream() {
  if (srcStream) {
    return;
  }
  if (srcVideo.captureStream) {
    srcStream = srcVideo.captureStream();
    console.log('Captured stream from srcVideo with captureStream',
      srcStream);
    call();
  } else if (srcVideo.mozCaptureStream) {
    srcStream = srcVideo.mozCaptureStream();
    console.log('Captured stream from srcVideo with mozCaptureStream()',
      srcStream);
    call();
  } else {
    trace('captureStream() not supported');
  }
}

// Video tag capture must be set up after video tracks are enumerated.
srcVideo.oncanplay = maybeCreateStream;
if (srcVideo.readyState >= 3) {  // HAVE_FUTURE_DATA
  // Video is already ready to play, call maybeCreateStream in case oncanplay
  // fired before we registered the event handler.
  maybeCreateStream();
}

srcVideo.play();

function setVideoTrackContentHints(stream, hint) {
  var tracks = stream.getVideoTracks();
  tracks.forEach(function(track) {
    if ('contentHint' in track) {
      track.contentHint = hint;
      if (track.contentHint !== hint) {
        trace('Invalid video track contentHint: \'' + hint + '\'');
      }
    } else {
      trace('MediaStreamTrack contentHint attribute not supported');
    }
  });
}

function call() {
  fluidStream = srcStream.clone();
  setVideoTrackContentHints(fluidStream, 'fluid');
  establishPC(fluidVideo, fluidStream);
  detailedStream = srcStream.clone();
  setVideoTrackContentHints(detailedStream, 'detailed');
  establishPC(detailedVideo, detailedStream);
}

function establishPC(videoTag, stream) {
  var pc1 = new RTCPeerConnection(null);
  var pc2 = new RTCPeerConnection(null);
  pc1.onicecandidate = function(e) {
    onIceCandidate(pc1, pc2, e);
  };
  pc2.onicecandidate = function(e) {
    onIceCandidate(pc2, pc1, e);
  };
  pc2.onaddstream = function(event) {
    gotRemoteStream(videoTag, event);
  };

  pc1.addStream(stream);
  pc1.createOffer(
    function(desc) {
      onCreateOfferSuccess(pc1, pc2, desc);
    }, onCreateSessionDescriptionError, offerOptions);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function onCreateOfferSuccess(pc1, pc2, desc) {
  pc1.setLocalDescription(desc, function() {}, onSetSessionDescriptionError);
  pc2.setRemoteDescription(desc, function() {}, onSetSessionDescriptionError);
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  pc2.createAnswer(
    function(answerDesc) {
      onCreateAnswerSuccess(pc1, pc2, answerDesc);
    }, onCreateSessionDescriptionError);
}

function onSetSessionDescriptionError(error) {
  trace('Failed to set session description: ' + error.toString());
}

function gotRemoteStream(video, event) {
  video.srcObject = event.stream;
}

function onCreateAnswerSuccess(pc1, pc2, desc) {
  // Hard-code video bitrate to 50kbps.
  desc.sdp = desc.sdp.replace(/a=mid:video\r\n/g,
                              'a=mid:video\r\nb=AS:' + 50 + '\r\n');
  pc2.setLocalDescription(desc, function() {}, onSetSessionDescriptionError);
  pc1.setRemoteDescription(desc, function() {}, onSetSessionDescriptionError);
}

function onIceCandidate(pc, otherPc, event) {
  if (event.candidate) {
    otherPc.addIceCandidate(event.candidate)
        .then(function() {}, function(err) {});
  }
}