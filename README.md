### API

#### 给服务器3个共享密钥中的2个，并提供钱包地址

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

{
    "address": "0x040e7783A06e9b994F6e90DF5b2933C03F1b8F21",
    "splits": [
        "80193e13ee645859df5f94935ae2c56525776aa717e105652bf5554a9f58570ade733",
        "8028d527f1d6a518d7a1deaffae3026d1cb20890d8925a2d5510de7ee7403921bd734"
    ]
}
```
#### 根据用户txid查询存款状态


Request:

```
curl --request GET \
  --url https://localhost:8443/deposit/0x5ab5550c6f4bdb32ee0e161dc161d3a4cc45326ee95a5253640c5cac5061bff8 \
  --header 'content-type: application/x-www-form-urlencoded'
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

#### 用户取款，需要提供另外1/3份密钥，打款地址和打款金额(单位:wei)


Request:

```
curl --request POST \
  --url https://localhost:8443/withdraw \
  --header 'content-type: application/json' \
  --data '{
	"split": "8031f1898a9c645ebcf45e5e31e7023fc5c8d2e679ad55c9231495cf066b8fce6eaff",
	"to": "0x14571A8f98301DB5dC5c7640A9C7f6CA5BEaB338",
	"value": 123
}'
```

Response: on success return txid for this withdraw transaction

```
{
    "txid": "0xca9d48cb163f6501a89b0c8b6584691fd9e9820896828f48baf01de9c938e6f5"
}
```