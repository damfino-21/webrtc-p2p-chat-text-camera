'use strict';

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
let localStream;


let allMessages = ''
const startTextingButton = document.getElementById('startTexting')
const leaveChatButton = document.getElementById('leaveChat')
const sendButton = document.getElementById('localSend')
let role = document.getElementById('roleOfPeer')

leaveChatButton.disabled = true

const chatBox = document.getElementById('incomingMessages')
const userInput = document.getElementById('userMessageBox')

let connection; // peer connection
let dataChannel; // data channel

const signalingChannel = new BroadcastChannel('webrtc')
signalingChannel.onmessage = event => {
    if (!localStream) {

        return;
    }
    if (event.data.type == 'offer') receivedOffer(event.data)
    else if (event.data.type == 'answer') receivedAnswer(event.data)
    else if (event.data.type == 'candidate') receivedICECandidate(event.data)
    else if (event.data.type == 'ready') {

        if (!connection) {
            makeCall()
            return
        }

        return;
    }
    else if (event.data.type == 'bye') {
        if (!connection) {
            return
        }
        hangup();
        return;
    }
    else {
        console.log("unhandled case of event listener");
    }
}

startTextingButton.onclick = async () => {

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localVideo.srcObject = localStream;

    startTextingButton.disabled = true
    leaveChatButton.disabled = false

    signalingChannel.postMessage({ type: 'ready' });
}

leaveChatButton.onclick = async () => {

    hangup();
    signalingChannel.postMessage({ type: 'bye' })
}

sendButton.onclick = async () => {

    if (userInput.value == '') {

        return
    }
    // read string from user input
    const message = userInput.value
    dataChannel.send(message)

    let dateTime = new Date();
    // paste the content this peer wrote into their chat box
    allMessages += 'me: ' + message + '\t' + dateTime.toDateString() + '\n';
    chatBox.value = allMessages

}

async function hangup() {

    if (!!connection) {
        connection.close()
        connection = null
    }
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;

    // TO-DO check if this is the right way to disconnect
    dataChannel.close();
    dataChannel = null

    startTextingButton.disabled = false;
    leaveChatButton.disabled = true;
}


async function createP2PConnection() {

    connection = new RTCPeerConnection()
    connection.onicecandidate = event => {
        const localMssg = {
            type: 'candidate',
            candidate: null
        }

        if (!!event.candidate) {
            localMssg.candidate = event.candidate.candidate;
            // sdp is session desc protocol, mid stands for? media identifier
            localMssg.sdpMid = event.candidate.sdpMid

            localMssg.sdpMLineIndex = event.candidate.sdpMLineIndex
        }
        signalingChannel.postMessage(localMssg)
    }
    connection.ontrack = e => remoteVideo.srcObject = e.streams[0];
    localStream.getTracks().forEach(track => connection.addTrack(track, localStream));

}

async function openDataChannel() {

    var dataChannelOptions = {
        ordered: true
    };

    dataChannel = connection.createDataChannel("myDataChannel", dataChannelOptions);
    dataChannel.onerror = function (error) {
    };

    dataChannel.onmessage = event => {
        receivedMessage(event.data)
    };

    dataChannel.onopen = event => {

    }
}

async function makeCall() {
    // caller will try to create a connection first
    await createP2PConnection()
    // whoever made the call should be the one to 
    // create a data channel from scratch
    await openDataChannel()

    // caller should be then ready to make its offer
    const offer = await connection.createOffer()


    signalingChannel.postMessage({
        type: 'offer',
        sdp: offer.sdp
    })
    await connection.setLocalDescription(offer)
    role.innerHTML = 'You are the <strong><i>caller</i></strong> of this session.'
    startTextingButton.disabled = true;
}


async function receivedOffer(offer) {

    if (!!connection) {
        return
    }

    //the other tab has received an offer
    await createP2PConnection()

    await connection.setRemoteDescription(offer)
    //so we will be disabling their connect button
    startTextingButton.disabled = true;

    const answer = await connection.createAnswer()

    await connection.setLocalDescription(answer)
    role.innerHTML = 'You are the <strong><i>responder</i></strong> of this session.'

    signalingChannel.postMessage({
        type: 'answer',
        sdp: answer.sdp
    })

    connection.addEventListener('datachannel', event => {
        dataChannel = event.channel;
        dataChannel.onmessage = event => {

            receivedMessage(event.data)
        };
        dataChannel.onopen = event => {


        }
    });


}


async function receivedAnswer(answer) {
    if (!!connection) {
        await connection.setRemoteDescription(answer)
    } else {
        console.log("no connection established.");
    }
    return
}


async function receivedICECandidate(candidate) {


    if (!!connection) {
        if (!!candidate.candidate) {
            await connection.addIceCandidate(candidate)
        } else { await connection.addIceCandidate(null) }
    } else {
        console.log("no connection established.");
    }

    return;
}

function receivedMessage(message) {
    let dateTime = new Date();
    allMessages += 'peer: ' + message + '\t' + dateTime.toDateString() + '\n';

    chatBox.value = allMessages

}

