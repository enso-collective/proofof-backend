const { Web3Auth } = require('@web3auth/node-sdk');
const { EthereumPrivateKeyProvider } = require('@web3auth/ethereum-provider');
const jwt = require('jsonwebtoken');
const fs = require('fs');
var privateKey = fs.readFileSync('privateKey.pem');

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: {
    chainConfig: {
      chainId: '0x5',
      rpcTarget: 'https://rpc.ankr.com/eth_goerli',
      displayName: 'goerli',
      blockExplorer: 'https://goerli.etherscan.io/',
      ticker: 'ETH',
      tickerName: 'Ethereum',
    },
  },
});

const web3auth = new Web3Auth({
  clientId: 'WEB3AUTH_CLIENT_ID',
  web3AuthNetwork: 'sapphire_mainnet',
  usePnPKey: false,
});

web3auth.init({ privateKeyProvider });

export const loginWithWeb3 = async () => {
  const user = {
    id: 'faj2720i2fdG7NsqznOKrthDvq43', // must be unique to each user
    name: 'Mohammad Shahbaz Alam',
    email: 'shahbaz@web3auth.io',
    profileImage: 'https://avatars.githubusercontent.com/u/46641595?v=4',
  };

  const web3authNodeprovider = await web3auth.connect({
    verifier: 'web3auth-sfa-verifier',
    verifierId: user.id,
    idToken: jwt.sign(
      {
        sub: user.id, // must be unique to each user
        name: user.name,
        email: user.email,
        picture: user.profileImage,
        aud: 'urn:my-resource-server',
        iss: 'https://my-authz-server',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      },
      privateKey,
      { algorithm: 'RS256', keyid: '1bb9605c36e69386830202b2d' },
    ),
  });
  const ethPublicAddress = await web3authNodeprovider.request({
    method: 'eth_accounts',
  });
};
