### Build docker image

build:

`docker build . -t signingserver`

run:

 `docker run signingserver --rm -it -p 8443:8443`

### API

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