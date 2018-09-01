### Build docker image

build:

`docker build . -t signingserver`

run:

 `docker run --rm -it -p 8443:8443 signingserver`

### ETH API

#### 1. 给服务器3个共享密钥中的2个，并提供钱包地址

Request:
```
curl --request POST \
  --url https://localhost:8443/shares \
  --header 'content-type: application/json' \
  --data '{
	"address": "0x040e7783A06e9b994F6e90DF5b2933C03F1b8F21",
 "splits":["80193e13ee645859df5f94935ae2c56525776aa717e105652bf5554a9f58570ade733", "8028d527f1d6a518d7a1deaffae3026d1cb20890d8925a2d5510de7ee7403921bd734"]
}'
```

Response:
```
{
    "address": "0x040e7783A06e9b994F6e90DF5b2933C03F1b8F21",
    "splits": [
        "80193e13ee645859df5f94935ae2c56525776aa717e105652bf5554a9f58570ade733",
        "8028d527f1d6a518d7a1deaffae3026d1cb20890d8925a2d5510de7ee7403921bd734"
    ]
}
```

成功时返回同样的值

#### 2. 根据用户txid查询存款状态

Request:

```
curl --request GET \
  --url https://localhost:8443/deposit/0x5ab5550c6f4bdb32ee0e161dc161d3a4cc45326ee95a5253640c5cac5061bff8
```

Response:

```

{
    "txid": "0x5ab5550c6f4bdb32ee0e161dc161d3a4cc45326ee95a5253640c5cac5061bff8",
    "from": "0x602ea273b80d2116ca4f1178002610aa7e82f8cd",
    "to": "0xcb5a1d293f9c10ea2f996db44fdfe129688a80ba",
    "status": true,
    "includedIn": 3788422,
    "currentHeight": 3794508
}
```


`txid`: 交易号

`from`: 转账方地址

`to`: 接收方地址

`status`: 交易是否成功标识

`includedIn`: 该交易在哪一个块被打包

`currentHeight`: 当前区块高度

可以根据`includedIn`和`currentHeight`差值确定该交易是否足够安全，建议6个区块以上

#### 3. 用户取款，需要提供另外1/3份密钥，打款地址和打款金额(单位:wei)


Request:

```
curl --request POST \
  --url https://localhost:8443/withdraw \
  --header 'content-type: application/json' \
  --data '{
    "nonce":
    "gasPrice":
    "gasLimit":
    "split": "8031f1898a9c645ebcf45e5e31e7023fc5c8d2e679ad55c9231495cf066b8fce6eaff",
    "to": "0x14571A8f98301DB5dC5c7640A9C7f6CA5BEaB338",
    "value": 123
}'
```

`split`: 被拆分的3份密钥之一

`to`: 接收地址

`value`: 转账数量(单位: wei)

Response:

```
{
    "from":
    "to":
    "rawTx":
    "txid": "0xca9d48cb163f6501a89b0c8b6584691fd9e9820896828f48baf01de9c938e6f5"
}
```

`txid`: 交易号

### BTC API

#### 1. withdraw btc

POST /btc/withdraw

```json
{
	"network": "testnet",
    "split":"8034fd6d9d3b9734e860238cea2975033339e56e6b2841a25a2c028538e9c708900ee",
    "feeUpperLimit": 10000000,
    "fromAddr": "mzJ1AAKQpMj5eaCL3b4oNuSantXmVgz2tM",
    "toAddrs": [
        {
            "address": "n38uMS8K3sM1PfypMd55YH8U4pUrSF4Jqo",
            "amount": 105572000
        },
        {
            "address": "ms8bQ6zx3JWKMa9w7sxZTk1M2ae5AYsbeJ",
            "amount": 7000011
        }

    ]
}

```

```json
{
    "rawTx": "010000000245e3c8d015aa83455f865043ed9b44336cf03397978703922235a8e6ecd4f426010000006b483045022100dbe5fcefc6d0f4226cb29ad212e147b5a2d8289ef90ea1f4f233ed30b95f044c02204a9a76372228c3bfdabeb097795e3977a004c4ef0f2ed124355e95b5c3cb78fe01210305a491aee8653f88a75534a7f4f0cb34efece7e38d57ff66aba82e42bc257b27fffffffff0e80b14db20021e5e24c64595ce05c8c45d61231f4abf9bea93fc5d60057af5010000006a4730440220119002e631dce278ee891c626628aee2c672a24b95708f0b8c805e3920758375022059c336f1507687d6967869f8ce15c0a88bc73478aef0b66db8d51d142ed4810f01210305a491aee8653f88a75534a7f4f0cb34efece7e38d57ff66aba82e42bc257b27ffffffff03a0e64a06000000001976a914ed272913a773e3b4288088859bed0ef5f501316688accbcf6a00000000001976a9147f66ea580b5d61169714cc35ecdf27e3f2cbf27788ac95636f00000000001976a914cdf75f817ef312950719f6fa1b947e75ab792d2688ac00000000",
    "txid": "b639d95256089dde290e6ce96e13a03cfdd7fd989169da98d0e2599572b729c6",
    "utxos": [
        {
            "address": "mzJ1AAKQpMj5eaCL3b4oNuSantXmVgz2tM",
            "txid": "26f4d4ece6a83522920387979733f06c33449bed4350865f4583aa15d0c8e345",
            "vout": 1,
            "scriptPubKey": "76a914cdf75f817ef312950719f6fa1b947e75ab792d2688ac",
            "amount": 1.05572,
            "satoshis": 105572000,
            "height": 1326054,
            "confirmations": 85970
        },
        {
            "address": "mzJ1AAKQpMj5eaCL3b4oNuSantXmVgz2tM",
            "txid": "f57a05605dfc93ea9bbf4a1f23615dc4c805ce9545c6245e1e0220db140be8f0",
            "vout": 1,
            "scriptPubKey": "76a914cdf75f817ef312950719f6fa1b947e75ab792d2688ac",
            "amount": 0.144,
            "satoshis": 14400000,
            "height": 1324324,
            "confirmations": 87700
        }
    ]
}
```

on error, return { "error": "xxxxx" }

#### 2. secret shares

POST /btc/shares

```json
{
    "network": "testnet" | "livenet",
    "address": "mzJ1AAKQpMj5eaCL3b4oNuSantXmVgz2tM",
    "splits": [
        "801722d119769a82fef7660102a3a5341d80fdaf665f8c6ba10bada0a2640c1797b2e",
        "802a630d783f110fdcfcf1ce707c7da6fdb10ff144ed229cde0f9b688eb71670a3a34"
    ]
}
```

on success, return the same json object.